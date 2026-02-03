import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyToken } from '../utils/auth';
import { reindexPhotos } from '../utils/reindex';
import { cleanupOrphanedFiles } from '../utils/maintenance';

export async function handleAdminRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
    // Admin Reindex Route
    if (path === '/api/admin/reindex' && request.method === 'POST') {
       const user = await verifyToken(request, env);
       if (!user || user.role !== 'admin') {
          return errorResponse('Forbidden', 403);
       }
       
       try {
          const { limit, offset } = await request.json() as { limit: number, offset: number };
          const result = await reindexPhotos(env, limit, offset);
          return jsonResponse(result);
       } catch (e: any) {
          return errorResponse(`Reindex failed: ${e.message}`, 500);
       }
    }
    
    // Admin Cleanup Route (Manual Trigger)
    if (path === '/api/admin/cleanup' && request.method === 'POST') {
       const user = await verifyToken(request, env);
       if (!user || user.role !== 'admin') {
          return errorResponse('Forbidden', 403);
       }
       
       try {
          const result = await cleanupOrphanedFiles(env);
          return jsonResponse(result);
       } catch (e: any) {
          return errorResponse(`Cleanup failed: ${e.message}`, 500);
       }
    }

    // Debug Route: Check if a photo ID exists in Vectorize
    if (path === '/api/debug/check-vector' && request.method === 'GET') {
       const user = await verifyToken(request, env);
       if (!user || user.role !== 'admin') return errorResponse('Forbidden', 403);
       
       const url = new URL(request.url);
       const id = url.searchParams.get('id');
       if (!id) return errorResponse('Missing id');
       
       try {
           if (!env.VECTORIZE) return errorResponse('No Vectorize binding');
           const vectors = await env.VECTORIZE.getByIds([id]);
           return jsonResponse({ 
               exists: vectors.length > 0, 
               vector: vectors[0] || null 
           });
       } catch (e: any) {
           return errorResponse(`Check failed: ${e.message}`, 500);
       }
    }

    return null;
}
