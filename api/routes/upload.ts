import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyToken } from '../utils/auth';
import * as db from '../utils/db';
import { decode as decodeJpeg } from '@jsquash/jpeg';
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp';
import resize from '@jsquash/resize';
import { encode as encodeBlurhash } from 'blurhash';
import exifr from 'exifr';

// AI Models
const TAG_MODEL = '@cf/microsoft/resnet-50'; // Classification
const CAPTION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf'; // Image to Text
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'; // Embeddings (768 dim)

export async function handleUploadRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
    const url = new URL(request.url);

    // Image Proxy for CORS (HEIC preview) - MUST be public (no Auth header in <img>)
    if (path === '/api/proxy-image' && request.method === 'GET') {
       const imageUrl = url.searchParams.get('url');
       if (!imageUrl) return errorResponse('Missing url parameter');

       // Relaxed security check for debugging
       // We allow configured domain, known domain, and the new custom domain
       const allowedDomain = env.R2_PUBLIC_DOMAIN || 'https://im.fivor.de';
       
       // Check against multiple allowed domains if needed
       const isAllowed = imageUrl.startsWith('https://im.fivor.de') || 
                         imageUrl.startsWith('https://hi.fivor.de') ||
                         imageUrl.startsWith(allowedDomain);

       if (!isAllowed) {
         return errorResponse(`Forbidden: Domain not allowed. Got ${imageUrl}`, 403);
       }

       try {
         const imageResp = await fetch(imageUrl);
         
         // If upstream fetch failed, relay the error
         if (!imageResp.ok) {
            return errorResponse(`Upstream fetch failed: ${imageResp.status} ${imageResp.statusText}`, 502);
         }

         const newHeaders = new Headers(imageResp.headers);
         
         // Force CORS headers
         newHeaders.set('Access-Control-Allow-Origin', '*');
         newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
         newHeaders.set('Access-Control-Allow-Headers', '*');

         // Optimization: Cache images for 1 year (immutable)
         newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
         
         return new Response(imageResp.body, {
           status: imageResp.status,
           headers: newHeaders
         });
       } catch (e: any) {
         return errorResponse(`Proxy error: ${e.message}`, 500);
       }
    }

    // Upload URL Route
    if (path === '/api/upload-url' && request.method === 'POST') {
      const user = await verifyToken(request, env);
      if (!user) return errorResponse('Unauthorized', 401);

      // Allow visitor if folder is allowed
      if (user.role !== 'admin' && user.role !== 'visitor') {
        return errorResponse('Forbidden', 403);
      }
      
      try {
        const { filename, folder } = await request.json() as { filename: string, folder: string };
        
        // Check visitor permissions
        if (user.role === 'visitor') {
           if (user.visitorId) {
              const currentVisitor = await db.getVisitor(env, user.visitorId);
              
              if (!currentVisitor) {
                 return errorResponse('Visitor not found or deleted', 403);
              }
              
              const allowedFolders = currentVisitor.allowedFolders || [];
              if (!allowedFolders.includes(folder)) {
                 return errorResponse(`Forbidden: You do not have permission to upload to this folder. Allowed: ${allowedFolders.join(', ')}`, 403);
              }
           } else {
              // Fallback
              const allowedFolders = (user as any).allowedFolders || [];
              if (!allowedFolders.includes(folder)) {
                 return errorResponse('Forbidden: You do not have permission to upload to this folder', 403);
              }
           }
        }

        const id = crypto.randomUUID();
        const key = `photos/${id}-${filename}`;
        
        const uploadUrl = `/api/upload-file?key=${encodeURIComponent(key)}`;
        const thumbnailKey = `photos/${id}-${filename.replace(/(\.[^.]+)$/, '-thumb.webp')}`;
        const thumbnailUploadUrl = `/api/upload-file?key=${encodeURIComponent(thumbnailKey)}`;
        
        const publicDomain = env.R2_PUBLIC_DOMAIN || 'https://r2.example.com'; 
        const publicUrl = `${publicDomain}/${key}`;

        return jsonResponse({
          uploadUrl,
          thumbnailUploadUrl,
          photoId: id,
          publicUrl,
          key,
          thumbnailKey
        });
      } catch (e) {
        return errorResponse('Invalid request');
      }
    }

    // Actual Upload Handler (Proxy)
    if (path === '/api/upload-file' && request.method === 'PUT') {
       const key = url.searchParams.get('key');
       if (!key) return errorResponse('Missing key');
       
       const filename = key.split('/').pop() || key; // Extract filename for AI fallback
       
       const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
       
       try {
          const arrayBuffer = await request.arrayBuffer();
          const originalSize = arrayBuffer.byteLength;
          
          let blurhash = null;
          let location = null;
          let aiTags: string[] = [];
          let aiDescription = null;

          // 1. Parse EXIF
          try {
             // exifr might fail on non-supported types, so wrap in try/catch
             const exifData = await exifr.parse(arrayBuffer);
             if (exifData && exifData.latitude && exifData.longitude) {
                location = { lat: exifData.latitude, lng: exifData.longitude, name: '' };
             }
          } catch (e) {
             // console.warn('EXIF extraction failed', e);
          }

          // 2. Image Processing (BlurHash, AI, Compression)
          const isImage = contentType.includes('jpeg') || contentType.includes('jpg') || contentType.includes('webp') || contentType.includes('png');
          let compressedBuffer = null;
          let compressed = false;
          let compressedSize = 0;

          if (isImage) {
             try {
                // A. Generate BlurHash (using small resize for speed)
                let imageData;
                try {
                    if (contentType.includes('webp')) {
                       imageData = await decodeWebp(arrayBuffer);
                    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                       imageData = await decodeJpeg(arrayBuffer);
                    }
                    
                    if (imageData) {
                        const smallForBlur = await resize(imageData, { width: 50, height: Math.round(50 * imageData.height / imageData.width) });
                        blurhash = encodeBlurhash(new Uint8ClampedArray(smallForBlur.data), smallForBlur.width, smallForBlur.height, 4, 3);
                    }
                } catch (e) {
                    console.warn('BlurHash/Decode generation failed', e);
                }

                // B. AI Tagging & Captioning
                try {
                   if (env.AI) {
                      // Use raw arrayBuffer for AI (skip resize to avoid WASM crash)
                      // Check size limit (2MB safety for Workers AI)
                      const isTooLarge = arrayBuffer.byteLength > 2 * 1024 * 1024;
                      const aiInput = isTooLarge ? null : [...new Uint8Array(arrayBuffer)];

                      // 1. Tagging
                      if (aiInput) {
                          try {
                              const aiRes = await env.AI.run(TAG_MODEL, { image: aiInput });
                              if (Array.isArray(aiRes)) {
                                 aiTags = aiRes.filter((t: any) => t.score > 0.35).map((t: any) => t.label);
                              }
                          } catch (tagErr) {
                              console.warn('AI Tagging failed', tagErr);
                          }
                      }

                      // 2. Captioning
                      try {
                         if (aiInput) {
                             const captionRes = await env.AI.run(CAPTION_MODEL, { 
                                 image: aiInput, 
                                 prompt: "Generate a concise caption for this image" 
                             });
                             if (captionRes && captionRes.description) {
                                 aiDescription = captionRes.description;
                             }
                         } else {
                             aiDescription = `Image: ${filename}`; // Fallback for large images
                         }
                      } catch (ce) {
                          console.error('Captioning failed', ce);
                          if (!aiDescription) aiDescription = `Image: ${filename}`;
                      }
                   }
                } catch (e) {
                   console.error('AI Processing failed', e);
                }

                // C. Vector Embedding (Vectorize)
                try {
                    if (env.AI && env.VECTORIZE) {
                       let description = aiDescription || `Image: ${filename}`;
                       
                       // Embed the text description
                       const { data } = await env.AI.run(EMBEDDING_MODEL, { text: description });
                       
                       let vectorData: number[] | null = null;
                       if (data && Array.isArray(data)) {
                          if (Array.isArray(data[0])) vectorData = data[0];
                          else vectorData = data;
                       }
                       
                       if (vectorData) {
                          const idMatch = key.match(/^photos\/([a-f0-9-]+)-/);
                          const vectorId = idMatch ? idMatch[1] : key;

                          await env.VECTORIZE.upsert([{
                             id: vectorId,
                             values: vectorData,
                             metadata: { key, uploadedAt: new Date().toISOString() }
                          }]);
                       }
                    }
                } catch (e) {
                    console.error('Vector embedding failed', e);
                }

                // D. Compression (Only if we decoded successfully)
                if (imageData && originalSize > 1024 * 1024) {
                   try {
                       const MAX_DIM = 1920; // Increased to 1920px for better preview
                       let finalImage = imageData;
                       const { width, height } = imageData;
                       
                       if (width > MAX_DIM || height > MAX_DIM) {
                           let newWidth = width;
                           let newHeight = height;
                           if (width > height) {
                               newWidth = MAX_DIM;
                               newHeight = Math.round((height * MAX_DIM) / width);
                           } else {
                               newHeight = MAX_DIM;
                               newWidth = Math.round((width * MAX_DIM) / height);
                           }
                           finalImage = await resize(imageData, { width: newWidth, height: newHeight });
                       }
                       
                       compressedBuffer = await encodeWebp(finalImage, { quality: 75 });
                       compressed = true;
                       compressedSize = compressedBuffer.byteLength;
                   } catch (compErr) {
                       console.warn('Compression failed', compErr);
                   }
                }
             } catch (e) {
                console.error('Image processing failed', e);
             }
          }

          // 3. Upload to R2
          if (compressed && compressedBuffer) {
             await env.BUCKET.put(key, compressedBuffer, {
                httpMetadata: { contentType: 'image/webp' }
             });
             const originalKey = `${key}-original`;
             await env.BUCKET.put(originalKey, arrayBuffer, {
                httpMetadata: { contentType }
             });
             
             return jsonResponse({ 
                success: true, 
                compressed: true,
                originalKey,
                originalSize,
                compressedSize,
                blurhash,
                location,
                aiTags,
                aiDescription
             });
          } else {
             await env.BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType } });
             return jsonResponse({ 
                success: true, 
                compressed: false,
                blurhash,
                location,
                aiTags,
                aiDescription
             });
          }
       } catch (e: any) {
          return errorResponse(`Upload failed: ${e.message}`, 500);
       }
    }

    return null;
}
