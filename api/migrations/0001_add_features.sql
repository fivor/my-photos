-- Migration number: 0001_add_features
-- Description: Add columns for AI tags, Location, BlurHash

ALTER TABLE photos ADD COLUMN blurhash TEXT;
ALTER TABLE photos ADD COLUMN location_lat REAL;
ALTER TABLE photos ADD COLUMN location_lng REAL;
ALTER TABLE photos ADD COLUMN location_name TEXT;
ALTER TABLE photos ADD COLUMN ai_tags TEXT; -- JSON array or comma separated
ALTER TABLE photos ADD COLUMN ai_description TEXT;

-- Create indexes for new features
CREATE INDEX idx_photos_location ON photos(location_lat, location_lng);
