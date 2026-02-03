import { Env } from './types';
import { handleAuthRoutes } from './routes/auth';
import { handleAdminRoutes } from './routes/admin';
import { handleDataRoutes } from './routes/data';
import { handleUploadRoutes } from './routes/upload';
import { handleSearchRoutes } from './routes/search';
import { errorResponse } from './utils/response';

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;
    
    // Ensure path starts with /api for internal routing consistency
    if (!path.startsWith('/api')) {
        path = '/api' + path;
    }

    // Try each route handler
    // Order matters if paths overlap, but here they are distinct enough.
    
    const authResponse = await handleAuthRoutes(request, env, path);
    if (authResponse) return authResponse;

    const adminResponse = await handleAdminRoutes(request, env, path);
    if (adminResponse) return adminResponse;

    const dataResponse = await handleDataRoutes(request, env, path);
    if (dataResponse) return dataResponse;

    const uploadResponse = await handleUploadRoutes(request, env, path);
    if (uploadResponse) return uploadResponse;

    const searchResponse = await handleSearchRoutes(request, env, path);
    if (searchResponse) return searchResponse;

    // Fallback
    return errorResponse('Not Found', 404);
}
