export interface Env {
  BUCKET: R2Bucket;
  ADMIN_PASSWORD?: string;
  VISITOR_PASSWORD?: string;
  JWT_SECRET?: string;
  SITE_TITLE?: string;
}

export interface Photo {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  date?: string;
  description?: string;
  folder: string;
  width?: number;
  height?: number;
  uploadedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  photoCount?: number;
}

export interface Metadata {
  version: string;
  lastUpdated: string;
  photos: Photo[];
  folders: Folder[];
}
