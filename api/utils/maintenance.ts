import { Env } from '../types';

export async function cleanupOrphanedFiles(env: Env): Promise<{ deleted: string[], scanned: number, kept: number }> {
  console.log('Starting orphaned file cleanup...');
  
  // 1. Get all valid Photo IDs from DB
  // We only need the IDs.
  const { results } = await env.DB.prepare('SELECT id FROM photos').all();
  const validIds = new Set(results.map((r: any) => r.id));
  
  console.log(`Found ${validIds.size} valid photos in DB.`);

  // 2. Iterate through R2 files
  let truncated = true;
  let cursor: string | undefined;
  const deletedKeys: string[] = [];
  let scannedCount = 0;
  
  while (truncated) {
    const list = await env.BUCKET.list({
      prefix: 'photos/',
      cursor,
      limit: 1000 // Max allowed
    });
    
    truncated = list.truncated;
    cursor = list.truncated ? list.cursor : undefined;
    
    const objects = list.objects;
    scannedCount += objects.length;
    
    const keysToDelete: string[] = [];
    
    for (const obj of objects) {
      const key = obj.key;
      // Key format: photos/<UUID>-<filename>
      // Regex to extract UUID: ^photos/([a-f0-9-]{36})-
      const match = key.match(/^photos\/([a-f0-9-]{36})(-|$)/);
      
      if (match) {
        const fileId = match[1];
        if (!validIds.has(fileId)) {
          // Orphan found!
          keysToDelete.push(key);
        }
      } else {
        // If file in photos/ folder doesn't match ID pattern, what do we do?
        // It might be a manual upload or garbage.
        // For safety, we only delete if we matched a UUID-like pattern and it wasn't in DB.
        // If it doesn't look like a UUID, we SKIP it to avoid deleting config files or other things 
        // if they accidentally ended up here (though we filter by photos/ prefix).
        // Let's assume strict UUID structure for our app.
        // If we are sure only our app writes to photos/, we could be more aggressive.
        // But safer is better.
      }
    }
    
    // Batch delete
    if (keysToDelete.length > 0) {
      await env.BUCKET.delete(keysToDelete);
      deletedKeys.push(...keysToDelete);
      console.log(`Deleted batch of ${keysToDelete.length} orphans.`);
    }
  }
  
  console.log(`Cleanup complete. Scanned: ${scannedCount}, Deleted: ${deletedKeys.length}`);
  return {
    deleted: deletedKeys,
    scanned: scannedCount,
    kept: scannedCount - deletedKeys.length
  };
}
