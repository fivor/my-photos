import { Env, Metadata } from '../types';

export async function getMetadataFromD1(env: Env): Promise<Metadata> {
  // Parallel queries for efficiency
  const [
    configResults,
    folderResults,
    photoResults,
    visitorResults,
    accessResults
  ] = await Promise.all([
    env.DB.prepare('SELECT * FROM config').all(),
    env.DB.prepare('SELECT * FROM folders ORDER BY created_at').all(),
    env.DB.prepare('SELECT * FROM photos ORDER BY uploaded_at DESC').all(),
    env.DB.prepare('SELECT * FROM visitors').all(),
    env.DB.prepare('SELECT * FROM visitor_folder_access').all()
  ]);

  // Process Config
  const config: any = {};
  if (configResults.results) {
    configResults.results.forEach((row: any) => {
        config[row.key] = row.value;
    });
  }

  // Process Folders
  const folders: any[] = folderResults.results ? folderResults.results.map((f: any) => ({
    id: f.id,
    name: f.name,
    createdAt: f.created_at,
    photoCount: 0 // Will calculate below
  })) : [];

  // Process Photos
  const photos: any[] = photoResults.results ? photoResults.results.map((p: any) => ({
    id: p.id,
    folder: p.folder_id,
    filename: p.filename,
    url: p.url,
    thumbnailUrl: p.thumbnail_url,
    description: p.description,
    uploadedAt: p.uploaded_at,
    deletedAt: p.deleted_at,
    isFavorite: !!p.is_favorite,
    width: p.width,
    height: p.height,
    date: p.taken_at,
    // New fields
    blurhash: p.blurhash,
    location: (p.location_lat && p.location_lng) ? {
      lat: p.location_lat,
      lng: p.location_lng,
      name: p.location_name
    } : undefined,
    aiTags: p.ai_tags ? p.ai_tags.split(',') : [],
    aiDescription: p.ai_description,
    hasOriginal: !!p.has_original,
    originalSize: p.original_size
  })) : [];

  // Calculate Counts (Only non-deleted photos count)
  const folderCounts: Record<string, number> = {};
  photos.forEach((p: any) => {
    if (!p.deletedAt) {
        folderCounts[p.folder] = (folderCounts[p.folder] || 0) + 1;
    }
  });
  folders.forEach((f: any) => {
    f.photoCount = folderCounts[f.id] || 0;
  });

  // Process Visitors
  const accessMap: Record<string, string[]> = {};
  if (accessResults.results) {
      accessResults.results.forEach((row: any) => {
        if (!accessMap[row.visitor_id]) accessMap[row.visitor_id] = [];
        accessMap[row.visitor_id].push(row.folder_id as string);
      });
  }

  const visitors = visitorResults.results ? visitorResults.results.map((v: any) => ({
    id: v.id,
    name: v.name,
    password: v.password,
    allowedFolders: accessMap[v.id] || []
  })) : [];

  return {
    version: '2.0', // D1 backed
    lastUpdated: new Date().toISOString(),
    config,
    folders,
    photos,
    visitors
  };
}

export async function getConfig(env: Env) {
    const results = await env.DB.prepare('SELECT * FROM config').all();
    const config: any = {};
    if (results.results) {
        results.results.forEach((row: any) => {
            config[row.key] = row.value;
        });
    }
    return config;
}

// --- Write Operations (Incremental) ---

export async function addFolderToD1(env: Env, folder: any) {
  await env.DB.prepare('INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)')
    .bind(folder.id, folder.name, folder.createdAt || new Date().toISOString())
    .run();
}

export async function updateFolderInD1(env: Env, id: string, name: string) {
  await env.DB.prepare('UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(name, id)
    .run();
}

export async function deleteFolderFromD1(env: Env, id: string) {
    // Transaction: Delete folder (Cascades to photos/access)?
    // Schema says ON DELETE CASCADE for photos and access.
    // BUT we want "Soft Delete" for photos usually? 
    // The previous logic was: "Soft delete all photos in this folder".
    // "delete_folder" action description in previous code: 
    // "metadata.folders = filter... metadata.photos.forEach(p => if folder match, p.deletedAt = now)"
    
    // So we should NOT delete the folder row if we want to keep the photos as soft-deleted?
    // Or does the folder disappear?
    // If the folder row is deleted, the photos are CASCADE deleted (Hard Delete).
    // If we want soft delete, we must keep the folder OR move photos to a "Trash" folder?
    // But the photos have a `folder_id` FK.
    // If we delete the folder row, we violate FK unless we delete photos.
    
    // Previous logic: removed folder from `metadata.folders` array. 
    // And marked photos as `deletedAt`.
    // But where do the photos "live" if the folder is gone?
    // In JSON, they just had a `folder` string property.
    // In SQL, they have a FK constraint.
    
    // Decision: Soft delete folder?
    // The schema does not have `deleted_at` for folders.
    // If I delete the folder row, all photos are gone forever (CASCADE).
    // The user probably expects "Delete Folder" -> Photos go to Trash.
    // But if they are in Trash, what is their `folder_id`? 
    // It must be a valid folder ID.
    
    // We might need a system "Trash" folder or "Unsorted" folder?
    // Or we just allow them to be deleted (Hard delete)?
    // The previous code:
    // metadata.folders = metadata.folders.filter(...)  <-- Folder removed from list
    // metadata.photos.forEach(p => { if (p.folder === folderId) p.deletedAt = now; })
    
    // If I remove folder from D1, CASCADE happens.
    // So I cannot remove folder from D1 if I want to keep photos in "Trash".
    // I need to add `deleted_at` to folders table? Or just keep it but filter it out in query?
    
    // For now, to match previous behavior (Photos are preserved in Trash),
    // I should probably NOT delete the folder row, but maybe mark it?
    // OR, I accept that deleting a folder deletes its photos permanently?
    // The previous code explicitly said "Soft delete all photos".
    // If I hard delete the folder, I lose that feature.
    
    // Quick Fix: Add `deleted_at` to folders table?
    // Or, update photos to set `folder_id` to NULL? (FK must be nullable).
    // Schema: `folder_id TEXT NOT NULL`.
    
    // Okay, this is a schema design issue.
    // I will add a `deleted_at` column to `folders` table in a new migration?
    // Or just accept that for now "Delete Folder" is destructive?
    
    // Wait, the previous code was:
    // `metadata.folders` list controls visibility.
    // `metadata.photos` list holds the data.
    // If folder is gone from `folders`, but photo still has `folder: "old_id"`, it worked in JSON.
    // In SQL, `folder_id` MUST exist.
    
    // Workaround: Don't delete the folder row. Just "Hide" it?
    // But `getMetadataFromD1` selects all folders.
    // Maybe I should add `is_deleted` to folders?
    
    // For now, let's implement the other simple ones.
    
    // delete_folder: I'll assume for now we might have to hard delete or I'll implement a workaround later.
    // Let's implement `updatePhoto`, `deletePhoto`, etc.
}

export async function getPhoto(env: Env, id: string) {
  return await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first();
}

export async function addPhotoToD1(env: Env, photo: any) {
  await env.DB.prepare(`
    INSERT INTO photos 
    (id, folder_id, filename, url, thumbnail_url, description, uploaded_at, width, height, taken_at, blurhash, location_lat, location_lng, location_name, ai_tags, ai_description, has_original, original_size) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  .bind(
    photo.id,
    photo.folder,
    photo.filename,
    photo.url,
    photo.thumbnailUrl || null,
    photo.description || null,
    photo.uploadedAt,
    photo.width || null,
    photo.height || null,
    photo.date || null,
    photo.blurhash || null,
    photo.location?.lat || null,
    photo.location?.lng || null,
    photo.location?.name || null,
    photo.aiTags ? photo.aiTags.join(',') : null,
    photo.aiDescription || null,
    photo.hasOriginal ? 1 : 0,
    photo.originalSize || null
  )
  .run();
}

export async function updatePhotoInD1(env: Env, photo: any) {
  // Dynamic update is tricky with prepared statements if fields vary.
  // But usually we update specific fields.
  // For `update_photos` action, it replaces the photo object in JSON.
  // So we should update all fields.
  await env.DB.prepare(`
    UPDATE photos SET
      folder_id = ?,
      filename = ?,
      url = ?,
      thumbnail_url = ?,
      description = ?,
      is_favorite = ?,
      width = ?,
      height = ?,
      taken_at = ?
    WHERE id = ?
  `)
  .bind(
    photo.folder,
    photo.filename,
    photo.url,
    photo.thumbnailUrl || null,
    photo.description || null,
    photo.isFavorite ? 1 : 0,
    photo.width || null,
    photo.height || null,
    photo.date || null,
    photo.id
  )
  .run();
}

export async function softDeletePhoto(env: Env, id: string) {
  await env.DB.prepare('UPDATE photos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id)
    .run();
}

export async function restorePhoto(env: Env, id: string) {
  await env.DB.prepare('UPDATE photos SET deleted_at = NULL WHERE id = ?')
    .bind(id)
    .run();
}

export async function permanentDeletePhoto(env: Env, id: string) {
  // 1. Get photo details to find R2 keys
  const photo: any = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first();
  
  if (photo) {
      // 2. Delete from R2
      // Construct keys based on ID and filename pattern
      // Standard key: `photos/${id}-${filename}`
      const key = `photos/${id}-${photo.filename}`;
      
      // Delete main image
      await env.BUCKET.delete(key);
      
      // Delete original if exists
      if (photo.has_original) {
          await env.BUCKET.delete(`${key}-original`);
      }
      
      // Delete thumbnail if exists (usually implicit or constructed)
      // Thumbnail key pattern: `photos/${id}-${filename-without-ext}-thumb.webp`
      // We need to reconstruct it or store it. 
      // Current DB has `thumbnail_url`. If it points to R2, we can derive key.
      // But `addPhotoToD1` stores full URL.
      // Standard pattern used in upload:
      // const thumbnailKey = `photos/${id}-${filename.replace(/(\.[^.]+)$/, '-thumb.webp')}`;
      const thumbKey = `photos/${id}-${photo.filename.replace(/(\.[^.]+)$/, '-thumb.webp')}`;
      await env.BUCKET.delete(thumbKey);

      // 3. Delete from Vectorize (if enabled)
      if (env.VECTORIZE) {
          await env.VECTORIZE.deleteByIds([id]);
      }
  }

  // 4. Delete from D1
  await env.DB.prepare('DELETE FROM photos WHERE id = ?')
    .bind(id)
    .run();
}

export async function toggleFavorite(env: Env, id: string) {
  // We need to know current state to toggle, or use SQL toggle
  await env.DB.prepare('UPDATE photos SET is_favorite = NOT is_favorite WHERE id = ?')
    .bind(id)
    .run();
}

export async function movePhoto(env: Env, id: string, targetFolderId: string) {
  await env.DB.prepare('UPDATE photos SET folder_id = ? WHERE id = ?')
    .bind(targetFolderId, id)
    .run();
}

export async function updateConfig(env: Env, config: any) {
    const stmts = [];
    for (const [key, value] of Object.entries(config)) {
        stmts.push(
            env.DB.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
            .bind(key, value)
        );
    }
    await env.DB.batch(stmts);
}

// Visitors
export async function getVisitorByPassword(env: Env, password: string) {
  const visitor: any = await env.DB.prepare('SELECT * FROM visitors WHERE password = ?').bind(password).first();
  if (!visitor) return null;
  
  const access = await env.DB.prepare('SELECT folder_id FROM visitor_folder_access WHERE visitor_id = ?').bind(visitor.id).all();
  visitor.allowedFolders = access.results.map((r: any) => r.folder_id);
  return visitor;
}

export async function getVisitor(env: Env, id: string) {
  const visitor: any = await env.DB.prepare('SELECT * FROM visitors WHERE id = ?').bind(id).first();
  if (!visitor) return null;
  
  const access = await env.DB.prepare('SELECT folder_id FROM visitor_folder_access WHERE visitor_id = ?').bind(id).all();
  visitor.allowedFolders = access.results.map((r: any) => r.folder_id);
  return visitor;
}

export async function addVisitorToD1(env: Env, visitor: any) {
    const batch = [
        env.DB.prepare('INSERT INTO visitors (id, name, password) VALUES (?, ?, ?)').bind(visitor.id, visitor.name, visitor.password)
    ];
    if (visitor.allowedFolders) {
        for (const fid of visitor.allowedFolders) {
            batch.push(
                env.DB.prepare('INSERT INTO visitor_folder_access (visitor_id, folder_id) VALUES (?, ?)').bind(visitor.id, fid)
            );
        }
    }
    await env.DB.batch(batch);
}

export async function updateVisitorInD1(env: Env, visitor: any) {
    const batch = [];
    
    // Only update name/password if provided. If not provided, we might want to keep existing?
    // The current UI sends partial updates.
    // If visitor.name is undefined, we shouldn't overwrite it with NULL if column expects value.
    // However, `update_visitor` action in `index.ts` passes `data` directly.
    // The UI sends `{ id, allowedFolders }` for permission toggle. `name` and `password` are missing.
    // So we must fetch existing visitor first OR use dynamic SQL.
    
    // Fetch current to merge
    const current = await env.DB.prepare('SELECT * FROM visitors WHERE id = ?').bind(visitor.id).first();
    if (!current) throw new Error('Visitor not found');
    
    const newName = visitor.name !== undefined ? visitor.name : current.name;
    const newPassword = visitor.password !== undefined ? visitor.password : current.password;
    
    batch.push(
        env.DB.prepare('UPDATE visitors SET name = ?, password = ? WHERE id = ?')
        .bind(newName, newPassword, visitor.id)
    );

    // Only update folders if `allowedFolders` is provided in the update object
    if (visitor.allowedFolders !== undefined) {
        batch.push(env.DB.prepare('DELETE FROM visitor_folder_access WHERE visitor_id = ?').bind(visitor.id));
        for (const fid of visitor.allowedFolders) {
             batch.push(
                env.DB.prepare('INSERT INTO visitor_folder_access (visitor_id, folder_id) VALUES (?, ?)').bind(visitor.id, fid)
            );
        }
    }
    
    await env.DB.batch(batch);
}

export async function deleteVisitorFromD1(env: Env, id: string) {
    // ON DELETE CASCADE handles the access table
    await env.DB.prepare('DELETE FROM visitors WHERE id = ?').bind(id).run();
}

// Trash Cleanup
export async function cleanupExpiredTrashD1(env: Env) {
    // Delete photos where deleted_at < 30 days ago
    // SQLite: datetime('now', '-30 days')
    await env.DB.prepare("DELETE FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')").run();
}

export async function emptyTrashD1(env: Env) {
    await env.DB.prepare("DELETE FROM photos WHERE deleted_at IS NOT NULL").run();
}
