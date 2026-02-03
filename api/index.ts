import { Env } from './types';
import { handleOptions } from './utils/response';
import { cleanupOrphanedFiles } from './utils/maintenance';
import { backupDatabase } from './utils/backup';
import { handleApiRequest } from './router';

// Polyfill for WASM loaders (jsquash) in Cloudflare Workers
if (typeof (globalThis as any).XMLHttpRequest === 'undefined') {
    (globalThis as any).XMLHttpRequest = class XMLHttpRequest {
        open() {}
        send() {}
        getAllResponseHeaders() { return ''; }
        setRequestHeader() {}
    };
}

export default {
  // Scheduled Task Handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run cleanup
    ctx.waitUntil(cleanupOrphanedFiles(env));
    // Run backup
    ctx.waitUntil(backupDatabase(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Identify if this is an API request
    const isApiDomain = url.hostname === 'api.fivor.de';
    const isApiPath = path.startsWith('/api');
    const isApiRequest = isApiDomain || isApiPath;

    // 1. Static Assets & SPA Fallback (Non-API)
    // If it's NOT an API request, serve assets immediately.
    if (!isApiRequest) {
       if (env.ASSETS) {
          const response = await env.ASSETS.fetch(request);
          if (response.status < 400) {
             return response;
          }
          // SPA Fallback for navigation
          if (request.method === 'GET') {
             return env.ASSETS.fetch(new URL('/index.html', request.url));
          }
       }
       return new Response('Not Found', { status: 404 });
    }

    // 2. API Handling
    
    // Handle CORS Preflight - GLOBAL HANDLER
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    
    // Delegate to Router
    return handleApiRequest(request, env);
  }
};
