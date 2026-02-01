import { Env, Metadata } from '../types';
import { getMetadata } from './storage';

export async function migrateJsonToD1(env: Env): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // 1. Fetch existing metadata from R2
    const metadata: Metadata = await getMetadata(env);
    
    if (!metadata) {
      return { success: false, message: 'No metadata found in R2' };
    }

    // 2. Prepare Batch Statements
    const statements: any[] = [];

    // --- Config ---
    if (metadata.config) {
      if (metadata.config.siteTitle) {
        statements.push(
          env.DB.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
            .bind('siteTitle', metadata.config.siteTitle)
        );
      }
      if (metadata.config.favicon) {
        statements.push(
          env.DB.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
            .bind('favicon', metadata.config.favicon)
        );
      }
    }

    // --- Folders ---
    if (metadata.folders && metadata.folders.length > 0) {
      for (const folder of metadata.folders) {
        statements.push(
          env.DB.prepare('INSERT OR REPLACE INTO folders (id, name, created_at) VALUES (?, ?, ?)')
            .bind(folder.id, folder.name, folder.createdAt || new Date().toISOString())
        );
      }
    }

    // --- Visitors ---
    if (metadata.visitors && metadata.visitors.length > 0) {
      for (const visitor of metadata.visitors) {
        statements.push(
          env.DB.prepare('INSERT OR REPLACE INTO visitors (id, name, password) VALUES (?, ?, ?)')
            .bind(visitor.id, visitor.name, visitor.password)
        );

        // Visitor Access
        if (visitor.allowedFolders && visitor.allowedFolders.length > 0) {
           for (const folderId of visitor.allowedFolders) {
             statements.push(
               env.DB.prepare('INSERT OR REPLACE INTO visitor_folder_access (visitor_id, folder_id) VALUES (?, ?)')
                 .bind(visitor.id, folderId)
             );
           }
        }
      }
    }

    // --- Photos ---
    // Photos can be large, we might need to batch them in chunks if there are thousands
    // But D1 batch limit is high enough for initial migration usually (or we split)
    if (metadata.photos && metadata.photos.length > 0) {
      for (const photo of metadata.photos) {
        statements.push(
          env.DB.prepare(`
            INSERT OR REPLACE INTO photos 
            (id, folder_id, filename, url, thumbnail_url, description, uploaded_at, deleted_at, is_favorite, width, height, taken_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              photo.id,
              photo.folder,
              photo.filename,
              photo.url,
              photo.thumbnailUrl || null,
              photo.description || null,
              photo.uploadedAt,
              photo.deletedAt || null,
              photo.isFavorite ? 1 : 0,
              photo.width || null,
              photo.height || null,
              photo.date || null // Assuming 'date' in JSON was the taken date
            )
        );
      }
    }

    // 3. Execute in Batches (D1 limits batch size, typically 128 operations per batch recommended, max 100 queries)
    // We'll split into chunks of 50 to be safe
    const BATCH_SIZE = 50;
    let successCount = 0;
    
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
       const batch = statements.slice(i, i + BATCH_SIZE);
       await env.DB.batch(batch);
       successCount += batch.length;
    }

    return { 
      success: true, 
      message: `Migration completed. Processed ${successCount} operations.`,
      details: {
        folders: metadata.folders.length,
        photos: metadata.photos.length,
        visitors: metadata.visitors?.length || 0
      }
    };

  } catch (e: any) {
    console.error('Migration failed:', e);
    return { success: false, message: `Migration failed: ${e.message}` };
  }
}
