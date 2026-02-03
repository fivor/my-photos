import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyToken } from '../utils/auth';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

export async function handleSearchRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
    // Semantic Search Route
    if (path === '/api/search' && request.method === 'POST') {
        const user = await verifyToken(request, env);
        if (!user) return errorResponse('Unauthorized', 401);

        try {
            const { query, limit = 20 } = await request.json() as { query: string, limit?: number };
            if (!query) return errorResponse('Query required');

            if (!env.VECTORIZE || !env.AI) {
                return errorResponse('Vector search not configured', 503);
            }

            // 1. Convert text query to embedding
            let finalQuery = query;
            let isTranslated = false;
            try {
               // Simple heuristic: if contains Chinese characters or other non-ascii
               if (/[^\x00-\x7F]/.test(query)) {
                   // Use Llama-3-8b for better translation than Qwen-0.5b
                   const translateRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
                       messages: [
                           { role: 'system', content: 'You are a professional translator. Translate the user input to English. Output ONLY the translated text. Do NOT add any quotes, explanations, or prefixes.' },
                           { role: 'user', content: query }
                       ]
                   });
                   if (translateRes && (translateRes as any).response) {
                       let translated = (translateRes as any).response.trim();
                       // Cleanup: remove quotes if present
                       translated = translated.replace(/^["']|["']$/g, '');
                       // Cleanup: remove "Translation:" prefix if present
                       translated = translated.replace(/^Translation:\s*/i, '');
                       
                       if (translated && translated.length > 0) {
                           finalQuery = translated;
                           isTranslated = true;
                       }
                   }
               }
            } catch (e) {
               console.error('Translation failed', e);
            }

            const aiRes: any = await env.AI.run(EMBEDDING_MODEL, { text: finalQuery });
            
            // Extract vector data
            let vectorData: number[] | null = null;
            if (aiRes && Array.isArray(aiRes.data)) {
               if (Array.isArray(aiRes.data[0])) vectorData = aiRes.data[0];
               else vectorData = aiRes.data;
            } else if (Array.isArray(aiRes)) {
               vectorData = aiRes;
            }

            if (!vectorData) {
               return errorResponse('Failed to generate query embedding', 500);
            }
            
            // 2. Query Vectorize
            // We request top K results
            const matches = await env.VECTORIZE.query(vectorData, { topK: limit, returnMetadata: true });
            
            // 3. Return IDs (Frontend can filter photos by these IDs)
            return jsonResponse({
                results: matches.matches.map(m => ({
                    id: m.id,
                    score: m.score
                })),
                debug: {
                    originalQuery: query,
                    finalQuery,
                    isTranslated,
                    matchCount: matches.matches.length
                }
            });

        } catch (e: any) {
            return errorResponse(`Search failed: ${e.message}`, 500);
        }
    }
    
    return null;
}
