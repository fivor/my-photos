import { Env } from '../types';
import { decode as decodeJpeg, encode as encodeJpeg } from '@jsquash/jpeg';
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp'; 
import resize from '@jsquash/resize';

// Polyfill for WASM loaders (jsquash) in Cloudflare Workers
if (typeof (globalThis as any).XMLHttpRequest === 'undefined') {
    (globalThis as any).XMLHttpRequest = class XMLHttpRequest {
        open() {}
        send() {}
        getAllResponseHeaders() { return ''; }
        setRequestHeader() {}
    };
}

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

export async function reindexPhotos(env: Env, limit: number = 5, offset: number = 0) {
    // Fetch photos
    const { results } = await env.DB.prepare('SELECT * FROM photos ORDER BY uploaded_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
    
    if (!results || results.length === 0) {
        return { processed: 0, errors: 0, hasMore: false };
    }

    let processed = 0;
    let errors = 0;
    let logs: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    for (const photo of results as any[]) {
        try {
            log(`[Reindex] Processing ${photo.id}, filename: ${photo.filename}`);
            
            // 1. Try to use THUMBNAIL first
            // Pattern in index.ts: 
            // const key = `photos/${id}-${filename}`;
            // const thumbnailKey = `photos/${id}-${filename.replace(/(\.[^.]+)$/, '-thumb.webp')}`;
            // So thumbKey is just mainKey with extension replaced by -thumb.webp
            
            const thumbKey = photo.filename.replace(/(\.[^.]+)$/, '-thumb.webp');
            
            log(`[Reindex] Trying thumbnail: ${thumbKey}`);
            let obj = await env.BUCKET.get(thumbKey);
            let finalKey = thumbKey;
            
            if (!obj) {
                log(`[Reindex] Thumbnail not found, trying main image...`);
                // Fallback to main image logic
                let key = photo.filename;
                obj = await env.BUCKET.get(key);
                
                if (!obj) {
                    const altKey = `photos/${photo.id}-${photo.filename}`;
                    obj = await env.BUCKET.get(altKey);
                    if (obj) key = altKey;
                }
                
                if (!obj && photo.filename.startsWith('photos/')) {
                     const cleanName = photo.filename.replace('photos/', '');
                     const altKey2 = `photos/${photo.id}-${cleanName}`;
                     obj = await env.BUCKET.get(altKey2);
                     if (obj) key = altKey2;
                }
                
                if (!obj) {
                    log(`[Reindex] File not found in R2: ${photo.filename}`);
                    errors++;
                    continue;
                }
                finalKey = key;
                log(`[Reindex] Found main image: ${key}, size: ${obj.size}`);
                
                // --- NEW: Generate Thumbnail on the fly if missing ---
                // This self-heals the system if upload failed to generate thumbnail
                try {
                    const mainBuffer = await obj.arrayBuffer();
                    let decoded;
                    const contentType = obj.httpMetadata?.contentType || '';
                    
                    if (contentType.includes('webp')) {
                        decoded = await decodeWebp(mainBuffer);
                    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                        decoded = await decodeJpeg(mainBuffer);
                    }
                    
                    if (decoded) {
                        log(`[Reindex] Generating missing thumbnail for ${photo.id}...`);
                        const smallForAI = await resize(decoded, { width: 500, height: Math.round(500 * decoded.height / decoded.width) });
                        const thumbBuffer = await encodeWebp(smallForAI); // Use WebP for thumbnail
                        
                        // Save to R2
                        await env.BUCKET.put(thumbKey, thumbBuffer, {
                             httpMetadata: { contentType: 'image/webp' }
                        });
                        
                        // Use this for AI
                        obj = { arrayBuffer: async () => thumbBuffer } as any; 
                        finalKey = thumbKey; // Use thumb for AI
                        log(`[Reindex] Generated thumbnail, using for AI.`);
                    }
                } catch (genErr) {
                    console.warn(`[Reindex] Failed to generate thumbnail: ${genErr}`);
                    // Fallback to main image (already loaded in mainBuffer?)
                    // We need to reload obj if we consumed arrayBuffer? 
                    // obj.arrayBuffer() can be called once usually if it's a stream?
                    // R2 object arrayBuffer() returns a new buffer.
                    // But we already awaited it.
                    // Let's just proceed with main image if gen failed.
                    obj = await env.BUCKET.get(key); // Re-fetch to be safe
                }
            } else {
                log(`[Reindex] Found thumbnail, size: ${obj.size}`);
            }
            
            if (!obj) {
                log(`[Reindex] Failed to get object data`);
                errors++;
                continue;
            }

            const arrayBuffer = await obj.arrayBuffer();
            
            // SKIP DECODING/RESIZING to avoid WASM crash
            // We just send raw bytes to AI.
            // Note: LLaVA and ResNet usually accept raw image bytes (jpeg/png). 
            // WebP might be tricky. If it fails, we might need a pure-js decoder or just skip WebP if model doesn't support it.
            // But let's try.
            
            // 1. Generate Caption
            // Note: We send raw uint8 array of the file
            // LLaVA limit: input size. If too large, we must skip or handle.
            // 3006: Request is too large.
            // If we hit this, we should just use filename or something basic?
            
            let description = "image";
            try {
                // If file size > 5MB, LLaVA might choke.
                // Or if it's main image and huge.
                if (arrayBuffer.byteLength > 2 * 1024 * 1024) { // > 2MB
                     // Too big for direct AI inference without resize?
                     // And we can't resize easily without jsquash.
                     // Fallback: Use filename as description?
                     log(`[Reindex] Image too large for AI (${Math.round(arrayBuffer.byteLength/1024)}KB). Skipping caption generation.`);
                     description = `Image: ${photo.filename}`;
                } else {
                    const captionRes = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', { 
                        image: [...new Uint8Array(arrayBuffer)], 
                        prompt: "Generate a detailed caption for this image" 
                    });
                    description = captionRes?.description || "image";
                }
            } catch (aiErr: any) {
                log(`[Reindex] Caption generation failed: ${aiErr.message || aiErr}`);
                // Fallback to filename
                description = `Image file ${photo.filename}`;
            }
            
            // 2. Embed the caption text
            // AND UPDATE DATABASE with the new description if it was missing or default!
            // We want to see what AI generated.
            
            if (description && description !== "image" && description !== `Image file ${photo.filename}` && description !== `Image: ${photo.filename}`) {
                try {
                    // Update DB with AI description if current is empty
                    // Or maybe we should add an `ai_description` column?
                    // For now, let's update `description` ONLY IF it is currently empty or null.
                    if (!photo.description) {
                        await env.DB.prepare('UPDATE photos SET description = ? WHERE id = ?')
                            .bind(description, photo.id)
                            .run();
                        log(`[Reindex] Updated DB description for ${photo.id}`);
                    } else {
                        // If description exists, maybe we append or just log?
                        // Let's NOT overwrite existing user description.
                        // But for SEARCH to work, we need to embed the AI description.
                        // We are already doing that below.
                        log(`[Reindex] Skipped DB update (description exists) for ${photo.id}`);
                    }
                } catch (dbErr) {
                    log(`[Reindex] Failed to update DB: ${dbErr}`);
                }
            }

            const aiRes: any = await env.AI.run(EMBEDDING_MODEL, { text: description });
            
            // Extract vector data
            let vectorData: number[] | null = null;
            if (aiRes && Array.isArray(aiRes.data)) {
                if (Array.isArray(aiRes.data[0])) {
                   vectorData = aiRes.data[0];
                } else {
                   vectorData = aiRes.data;
                }
            } else if (Array.isArray(aiRes)) {
                vectorData = aiRes;
            }
            
            if (vectorData) {
                 await env.VECTORIZE.upsert([{
                    id: photo.id, 
                    values: vectorData,
                    metadata: { key: finalKey, uploadedAt: photo.uploaded_at }
                 }]);
                 processed++;
                 log(`[Reindex] Success for ${photo.id}`);
            } else {
                 log(`AI model returned no data for ${finalKey} ${JSON.stringify(aiRes)}`);
                 errors++;
            }
            
        } catch (e) {
            log(`Failed to reindex ${photo.id}: ${e}`);
            errors++;
        }
    }
    
    return { processed, errors, hasMore: results.length === limit, logs };
}
