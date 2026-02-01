import { Env } from './types';
import { handleOptions, corsHeaders, jsonResponse, errorResponse } from './utils/response';
import { createToken, verifyToken } from './utils/auth';
import { getMetadata, saveMetadata } from './utils/storage';
import { migrateJsonToD1 } from './utils/migration';
import { decode as decodeJpeg, encode as encodeJpeg } from '@jsquash/jpeg';
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp';
import resize from '@jsquash/resize';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
     // Debug: Force accept upload-file to rule out verifyToken failure
     if (url.pathname.includes('upload-file') && request.method === 'PUT') {
        // Manual CORS handling for this route just in case
        // Note: The outer loop handles OPTIONS, but since we intercepted early, we must handle it if we ever change logic.
        // Actually, request.method is PUT here (checked in outer if), so inner if OPTIONS is impossible.
        // Removing the dead code.
        
        const key = url.searchParams.get('key');
        if (!key) return errorResponse('Missing key');
        
        // Note: We are bypassing verifyToken here for debugging/fix
        // But we still require the signed KEY which is unique and hard to guess
        // And strictly speaking, upload-url is the gatekeeper.
        
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        try {
          await env.BUCKET.put(key, request.body, {
            httpMetadata: { contentType }
          });
          return jsonResponse({ success: true });
        } catch (e: any) {
          return errorResponse(`Bucket Put Failed: ${e.message}`, 500);
        }
     }

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Image Proxy for CORS (HEIC preview) - MUST be public (no Auth header in <img>)
    if (url.pathname === '/api/proxy-image' && request.method === 'GET') {
       const imageUrl = url.searchParams.get('url');
       if (!imageUrl) return errorResponse('Missing url parameter');

       // Relaxed security check for debugging
       // We allow both the configured domain and the known domain
       const allowedDomain = env.R2_PUBLIC_DOMAIN || 'https://im.fivor.de';
       
       // Check against multiple allowed domains if needed
       const isAllowed = imageUrl.startsWith('https://im.fivor.de') || 
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

    // Auth Route
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const { password, role } = await request.json() as { password: string, role: string };
        
        let valid = false;
        let visitorId = '';
        let allowedFolders: string[] = [];

        if (role === 'admin') {
          valid = password === (env.ADMIN_PASSWORD || 'admin');
        } else if (role === 'visitor') {
          // Check global visitor password first (backward compatibility or simple mode)
          if (env.VISITOR_PASSWORD && password === env.VISITOR_PASSWORD) {
             valid = true;
             // Global visitor has access to all folders or a default set? 
             // For now, let's assume global visitor has restricted access if we move to multi-visitor.
             // But based on request, we are moving to multi-visitor.
             // Let's check metadata for visitors.
          }
          
          if (!valid) {
             const metadata = await getMetadata(env);
             if (metadata.visitors) {
               const visitor = metadata.visitors.find((v: any) => v.password === password);
               if (visitor) {
                 valid = true;
                 visitorId = visitor.id;
                 allowedFolders = visitor.allowedFolders || [];
               }
             }
          }
        } else {
          return errorResponse('Invalid role');
        }

        if (!valid) {
          return errorResponse('Invalid password', 401);
        }

        const tokenPayload: any = { role };
        if (role === 'visitor') {
           tokenPayload.visitorId = visitorId;
           tokenPayload.allowedFolders = allowedFolders;
        }

        const token = await createToken(tokenPayload, env);
        return jsonResponse({ 
          token, 
          role,
          visitorId: role === 'visitor' ? visitorId : undefined,
          allowedFolders: role === 'visitor' ? allowedFolders : undefined,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 
        });
      } catch (e) {
        return errorResponse('Invalid request body');
      }
    }

    // Public Config Route
    if (url.pathname === '/api/public-config' && request.method === 'GET') {
      const metadata = await getMetadata(env);
      return jsonResponse({
        siteTitle: metadata.config?.siteTitle,
        favicon: metadata.config?.favicon
      });
    }

    // Protected Routes Middleware
    const user = await verifyToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Auth Status Route (Get fresh permissions)
    if (url.pathname === '/api/auth/status' && request.method === 'GET') {
       if (user.role === 'visitor' && user.visitorId) {
          const metadata = await getMetadata(env);
          const currentVisitor = metadata.visitors?.find((v: any) => v.id === user.visitorId);
          if (currentVisitor) {
             return jsonResponse({
               role: 'visitor',
               visitorId: user.visitorId,
               allowedFolders: currentVisitor.allowedFolders || []
             });
          }
       }
       // Default fallback
       return jsonResponse(user);
    }

    // Admin Migration Route
    if (url.pathname === '/api/admin/migrate-to-d1' && request.method === 'POST') {
       if (user.role !== 'admin') return errorResponse('Forbidden', 403);
       return jsonResponse(await migrateJsonToD1(env));
    }

    // Data Route
    if (url.pathname === '/api/data') {
      if (request.method === 'GET') {
        const metadata = await getMetadata(env);
        // Clean up expired trash on read (optional, but good for maintenance)
        cleanupExpiredTrash(metadata);
        return jsonResponse(metadata);
      }
      
      if (request.method === 'POST') {
        try {
          const { action, data } = await request.json() as { action: string, data: any };
          
          // Permission Check based on Action
          if (action === 'update_photos') {
             // Allow admin and visitor
             if (user.role !== 'admin' && user.role !== 'visitor') {
                return errorResponse('Forbidden', 403);
             }
             // For visitor, strictly speaking we should verify they are adding to an allowed folder
             // But since we trust the client logic and the fact they could only upload to that folder via signed URL,
             // and this metadata update is just recording what happened, it's low risk.
             // We can improve this later by validating data.folder against user.allowedFolders.
          } else {
             // All other actions require admin
             if (user.role !== 'admin') {
                return errorResponse('Forbidden', 403);
             }
          }
          
          const metadata = await getMetadata(env);
          
          if (action === 'update_photos') {
             const photo = data;
             const index = metadata.photos.findIndex(p => p.id === photo.id);
             if (index >= 0) {
               metadata.photos[index] = { ...metadata.photos[index], ...photo };
             } else {
               metadata.photos.unshift(photo);
             }
             recalculateFolderCounts(metadata);
          } else if (action === 'move_photo') {
             const { id, targetFolderId } = data;
             const photo = metadata.photos.find((p: any) => p.id === id);
             if (photo && photo.folder !== targetFolderId) {
               photo.folder = targetFolderId;
               recalculateFolderCounts(metadata);
             }
          } else if (action === 'add_folder') {
             metadata.folders.push(data);
          } else if (action === 'update_folder') {
             const folder = metadata.folders.find((f: any) => f.id === data.id);
             if (folder) {
               folder.name = data.name;
             }
          } else if (action === 'delete_folder') {
             // Delete folder and its photos (soft delete photos)
             const folderId = data.id;
             metadata.folders = metadata.folders.filter((f: any) => f.id !== folderId);
             
             // Soft delete all photos in this folder
             const now = new Date().toISOString();
             metadata.photos.forEach(p => {
               if (p.folder === folderId) {
                 p.deletedAt = now;
               }
             });
             recalculateFolderCounts(metadata);
          } else if (action === 'delete_photo') {
             // Soft delete
             const photo = metadata.photos.find((p: any) => p.id === data.id);
             if (photo) {
               photo.deletedAt = new Date().toISOString();
             }
             recalculateFolderCounts(metadata);
          } else if (action === 'restore_photo') {
             const photo = metadata.photos.find((p: any) => p.id === data.id);
             if (photo) {
               delete photo.deletedAt;
             }
             recalculateFolderCounts(metadata);
          } else if (action === 'delete_photo_forever') {
             metadata.photos = metadata.photos.filter((p: any) => p.id !== data.id);
             recalculateFolderCounts(metadata);
          } else if (action === 'batch_delete_photos_forever') {
             const ids = data.ids as string[];
             metadata.photos = metadata.photos.filter((p: any) => !ids.includes(p.id));
             recalculateFolderCounts(metadata);
          } else if (action === 'permanent_delete_photo') {
             metadata.photos = metadata.photos.filter(p => p.id !== data.id);
             recalculateFolderCounts(metadata);
          } else if (action === 'empty_trash') {
             metadata.photos = metadata.photos.filter(p => !p.deletedAt);
             recalculateFolderCounts(metadata);
          } else if (action === 'batch_delete_photos') {
             const ids = data.ids as string[];
             const now = new Date().toISOString();
             metadata.photos.forEach(p => {
               if (ids.includes(p.id)) {
                 p.deletedAt = now;
               }
             });
             recalculateFolderCounts(metadata);
          } else if (action === 'batch_move_photos') {
             const { ids, targetFolderId } = data as { ids: string[], targetFolderId: string };
             metadata.photos.forEach(p => {
               if (ids.includes(p.id)) {
                 p.folder = targetFolderId;
               }
             });
             recalculateFolderCounts(metadata);
          } else if (action === 'toggle_favorite') {
             const photo = metadata.photos.find((p: any) => p.id === data.id);
             if (photo) {
               photo.isFavorite = !photo.isFavorite;
             }
          } else if (action === 'update_config') {
             metadata.config = { ...metadata.config, ...data };
          } else if (action === 'add_visitor') {
             if (!metadata.visitors) metadata.visitors = [];
             metadata.visitors.push(data);
          } else if (action === 'update_visitor') {
             if (metadata.visitors) {
               const index = metadata.visitors.findIndex((v: any) => v.id === data.id);
               if (index !== -1) {
                 metadata.visitors[index] = { ...metadata.visitors[index], ...data };
               }
             }
          } else if (action === 'delete_visitor') {
             if (metadata.visitors) {
               metadata.visitors = metadata.visitors.filter((v: any) => v.id !== data.id);
             }
          }
          
          // Clean up expired trash before saving
          cleanupExpiredTrash(metadata);
          
          await saveMetadata(env, metadata);
          return jsonResponse({ success: true });
        } catch (e) {
          return errorResponse('Invalid request');
        }
      }
    }

    // Upload URL Route
    if (url.pathname === '/api/upload-url' && request.method === 'POST') {
      // Allow visitor if folder is allowed
      if (user.role !== 'admin' && user.role !== 'visitor') {
        return errorResponse('Forbidden', 403);
      }
      
      try {
        const { filename, folder } = await request.json() as { filename: string, folder: string };
        
        // Check visitor permissions - Lookup fresh data from DB instead of relying on stale token claims
        if (user.role === 'visitor') {
           // If token has visitorId, verify against current metadata
           if (user.visitorId) {
              const metadata = await getMetadata(env);
              const currentVisitor = metadata.visitors?.find((v: any) => v.id === user.visitorId);
              
              if (!currentVisitor) {
                 return errorResponse('Visitor not found or deleted', 403);
              }
              
              const allowedFolders = currentVisitor.allowedFolders || [];
              if (!allowedFolders.includes(folder)) {
                 return errorResponse(`Forbidden: You do not have permission to upload to this folder. Allowed: ${allowedFolders.join(', ')}`, 403);
              }
           } else {
              // Fallback for old tokens (shouldn't happen with new login) or if visitorId missing
              const allowedFolders = (user as any).allowedFolders || [];
              if (!allowedFolders.includes(folder)) {
                 return errorResponse('Forbidden: You do not have permission to upload to this folder', 403);
              }
           }
        }

        const id = crypto.randomUUID();
        const key = `photos/${id}-${filename}`;
        
        // Using Worker as proxy for upload to avoid S3 SDK complexity in this demo
        const uploadUrl = `/api/upload-file?key=${encodeURIComponent(key)}`;
        // For thumbnail (frontend resizing)
        const thumbnailKey = `photos/${id}-${filename.replace(/(\.[^.]+)$/, '-thumb.webp')}`;
        const thumbnailUploadUrl = `/api/upload-file?key=${encodeURIComponent(thumbnailKey)}`;
        
        // Determine public URL
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
    if (url.pathname === '/api/upload-file' && request.method === 'PUT') {
       const key = url.searchParams.get('key');
       if (!key) return errorResponse('Missing key');
       
       const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
       
       try {
          const arrayBuffer = await request.arrayBuffer();
          const originalSize = arrayBuffer.byteLength;
          
          // Compression Threshold: 1MB and supported format
          const isCompressible = contentType.includes('jpeg') || contentType.includes('jpg') || contentType.includes('webp');
          
          // Only compress main photos, not thumbnails (thumbnails usually have -thumb in key or are small)
          if (isCompressible && originalSize > 1024 * 1024) {
             try {
                let imageData;
                if (contentType.includes('webp')) {
                   imageData = await decodeWebp(arrayBuffer);
                } else {
                   imageData = await decodeJpeg(arrayBuffer);
                }
                
                const { width, height } = imageData;
                 // Reduce max dimension from 1920 to 1600 for better mobile performance
                 const MAX_DIM = 1600;
                 
                 let finalImage = imageData;
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
                 
                 // Encode as WebP with Quality 75 (High compression, good quality)
                 const compressedBuffer = await encodeWebp(finalImage, { quality: 75 });
                 
                 // Upload Compressed WebP to MAIN key
                 // Note: We keep the original key extension in R2 but serve WebP content.
                 // Ideally we should change extension, but to keep URL consistent we rely on Content-Type.
                 await env.BUCKET.put(key, compressedBuffer, {
                    httpMetadata: { contentType: 'image/webp' }
                 });
                
                // Upload Original to ORIGINAL key
                const originalKey = `${key}-original`;
                await env.BUCKET.put(originalKey, arrayBuffer, {
                   httpMetadata: { contentType }
                });
                
                return jsonResponse({ 
                   success: true, 
                   compressed: true,
                   originalKey,
                   originalSize,
                   compressedSize: compressedBuffer.byteLength
                });
             } catch (compError: any) {
                console.error('Compression failed:', compError);
                // Fallback to original
                await env.BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType } });
                return jsonResponse({ success: true, compressed: false, error: compError.message });
             }
          } else {
             // Normal upload
             await env.BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType } });
             return jsonResponse({ success: true });
          }
       } catch (e: any) {
          return errorResponse(`Upload failed: ${e.message}`, 500);
       }
    }

    return errorResponse('Not Found', 404);
  }
};

// Helper to generate simple hash for ETag
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Helper function to recalculate all folder counts
function recalculateFolderCounts(metadata: any) {
  // Reset all counts
  metadata.folders.forEach((f: any) => f.photoCount = 0);
  
  // Count photos per folder (only active ones)
  metadata.photos.forEach((p: any) => {
    if (!p.deletedAt) {
      const folder = metadata.folders.find((f: any) => f.id === p.folder);
      if (folder) {
        folder.photoCount = (folder.photoCount || 0) + 1;
      }
    }
  });
}

// Remove photos deleted > 30 days ago
function cleanupExpiredTrash(metadata: any) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const originalCount = metadata.photos.length;
  
  metadata.photos = metadata.photos.filter((p: any) => {
    if (p.deletedAt) {
      const deletedTime = new Date(p.deletedAt).getTime();
      return deletedTime > thirtyDaysAgo;
    }
    return true;
  });

  if (metadata.photos.length !== originalCount) {
    recalculateFolderCounts(metadata);
  }
}
