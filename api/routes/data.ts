import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyToken } from '../utils/auth';
import * as db from '../utils/db';

export async function handleDataRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
    // Public Config Route
    if (path === '/api/public-config' && request.method === 'GET') {
      const config = await db.getConfig(env);
      return jsonResponse({
        siteTitle: config.siteTitle,
        favicon: config.favicon
      });
    }

    // Data Route
    if (path === '/api/data') {
      // 1. GET: Read Metadata
      if (request.method === 'GET') {
        const user = await verifyToken(request, env);
        if (!user) return errorResponse('Unauthorized', 401);

        // Clean up expired trash on read (optional, but good for maintenance)
        await db.cleanupExpiredTrashD1(env);
        const metadata = await db.getMetadataFromD1(env);
        return jsonResponse(metadata);
      }
      
      // 2. POST: Write Actions
      if (request.method === 'POST') {
        const user = await verifyToken(request, env);
        if (!user) return errorResponse('Unauthorized', 401);

        try {
          const { action, data } = await request.json() as { action: string, data: any };
          
          // Permission Check based on Action
          if (action === 'update_photos') {
             // Allow admin and visitor
             if (user.role !== 'admin' && user.role !== 'visitor') {
                return errorResponse('Forbidden', 403);
             }
          } else {
             // All other actions require admin
             if (user.role !== 'admin') {
                return errorResponse('Forbidden', 403);
             }
          }
          
          // Execute Action on DB
          if (action === 'update_photos') {
             const photo = data;
             // Check if exists
             const existing = await db.getPhoto(env, photo.id);
             if (existing) {
               await db.updatePhotoInD1(env, photo);
             } else {
               await db.addPhotoToD1(env, photo);
             }
          } else if (action === 'move_photo') {
             await db.movePhoto(env, data.id, data.targetFolderId);
          } else if (action === 'add_folder') {
             await db.addFolderToD1(env, data);
          } else if (action === 'update_folder') {
             await db.updateFolderInD1(env, data.id, data.name);
          } else if (action === 'delete_folder') {
             await db.deleteFolderFromD1(env, data.id);
          } else if (action === 'delete_photo') {
             await db.softDeletePhoto(env, data.id);
          } else if (action === 'restore_photo') {
             await db.restorePhoto(env, data.id);
          } else if (action === 'delete_photo_forever') {
             await db.permanentDeletePhoto(env, data.id);
          } else if (action === 'batch_delete_photos_forever') {
             const ids = data.ids as string[];
             for (const id of ids) {
                 await db.permanentDeletePhoto(env, id);
             }
          } else if (action === 'permanent_delete_photo') {
             await db.permanentDeletePhoto(env, data.id);
          } else if (action === 'empty_trash') {
             await db.emptyTrashD1(env);
          } else if (action === 'batch_delete_photos') {
             const ids = data.ids as string[];
             for (const id of ids) {
                 await db.softDeletePhoto(env, id);
             }
          } else if (action === 'batch_move_photos') {
             const { ids, targetFolderId } = data as { ids: string[], targetFolderId: string };
             for (const id of ids) {
                 await db.movePhoto(env, id, targetFolderId);
             }
          } else if (action === 'toggle_favorite') {
             await db.toggleFavorite(env, data.id);
          } else if (action === 'update_config') {
             await db.updateConfig(env, data);
          } else if (action === 'add_visitor') {
             await db.addVisitorToD1(env, data);
          } else if (action === 'update_visitor') {
             await db.updateVisitorInD1(env, data);
          } else if (action === 'delete_visitor') {
             await db.deleteVisitorFromD1(env, data.id);
          }
          
          return jsonResponse({ success: true });
        } catch (e: any) {
          console.error('DB Action failed:', e);
          return errorResponse(`Invalid request: ${e.message}`);
        }
      }
    }

    return null;
}
