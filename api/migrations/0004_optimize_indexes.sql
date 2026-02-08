-- Migration number: 0004_optimize_indexes
-- Description: Add indexes to improve query performance

-- Optimize "All Photos" view and pagination (WHERE deleted_at IS NULL ORDER BY taken_at DESC)
CREATE INDEX IF NOT EXISTS idx_photos_deleted_taken ON photos(deleted_at, taken_at DESC);

-- Optimize "Folder" view and Folder Counts (WHERE folder_id = ? AND deleted_at IS NULL)
-- Also helps GROUP BY folder_id
CREATE INDEX IF NOT EXISTS idx_photos_folder_deleted_taken ON photos(folder_id, deleted_at, taken_at DESC);

-- Optimize "Favorites" view
CREATE INDEX IF NOT EXISTS idx_photos_favorite_deleted ON photos(is_favorite, deleted_at);

-- Optimize Trash view (WHERE deleted_at IS NOT NULL)
-- The existing deleted_at index (if any) or the first part of idx_photos_deleted_taken might help, 
-- but a partial index or specific one is better if trash is small. 
-- However, standard B-Tree on deleted_at is sufficient.
