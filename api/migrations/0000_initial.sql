-- Migration number: 0000_initial
-- Description: Initial Schema Design for Photo Gallery

-- 1. Folders Table
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Photos Table
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    description TEXT,
    taken_at DATETIME, -- The actual photo date (EXIF)
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME, -- Soft delete support
    is_favorite BOOLEAN DEFAULT 0,
    width INTEGER,
    height INTEGER,
    has_original BOOLEAN DEFAULT 0,
    original_size INTEGER,
    mime_type TEXT,
    exif_data TEXT, -- JSON string for extended EXIF info
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Indexes for Photos
CREATE INDEX idx_photos_folder ON photos(folder_id);
CREATE INDEX idx_photos_deleted ON photos(deleted_at);
CREATE INDEX idx_photos_favorite ON photos(is_favorite);
CREATE INDEX idx_photos_date ON photos(taken_at);

-- 3. Visitors Table
CREATE TABLE visitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL, -- Plain text for now as per legacy logic, should be hashed later
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Visitor Folder Access (Many-to-Many)
CREATE TABLE visitor_folder_access (
    visitor_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (visitor_id, folder_id),
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 5. Config Table (Key-Value Store)
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
