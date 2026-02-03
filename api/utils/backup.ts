import { Env } from '../types';
import { getMetadataFromD1 } from './db';

export async function backupDatabase(env: Env) {
  try {
    // 1. Export all data
    // We can reuse getMetadataFromD1 which fetches everything except `login_attempts` etc.
    // Or we can do a raw dump.
    // For restoration purposes, a raw dump of tables is better.
    
    const tables = ['config', 'folders', 'photos', 'visitors', 'visitor_folder_access'];
    const backupData: any = {};
    
    for (const table of tables) {
        const res = await env.DB.prepare(`SELECT * FROM ${table}`).all();
        backupData[table] = res.results;
    }
    
    // 2. Save to R2
    const date = new Date().toISOString().split('T')[0];
    const timestamp = new Date().getTime();
    const key = `backups/db-${date}-${timestamp}.json`;
    
    await env.BUCKET.put(key, JSON.stringify(backupData, null, 2), {
        httpMetadata: { contentType: 'application/json' }
    });
    
    console.log(`Backup successful: ${key}`);
    return { success: true, key };
  } catch (e) {
    console.error('Backup failed', e);
    return { success: false, error: e };
  }
}
