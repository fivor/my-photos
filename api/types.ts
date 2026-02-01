/// <reference types="@cloudflare/workers-types" />

export interface Env {
  BUCKET: R2Bucket;
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  VISITOR_PASSWORD?: string;
  JWT_SECRET?: string;
  SITE_TITLE?: string;
  R2_PUBLIC_DOMAIN?: string;
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
  deletedAt?: string;
  isFavorite?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  photoCount?: number;
}

export interface Visitor {
  id: string;
  name: string;
  password: string;
  allowedFolders: string[];
}

export interface Metadata {
  version: string;
  lastUpdated: string;
  photos: Photo[];
  folders: Folder[];
  visitors?: Visitor[];
  config?: {
    siteTitle?: string;
    favicon?: string;
  };
}
