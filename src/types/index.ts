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
  hasOriginal?: boolean;
  originalSize?: number;
  // New fields matching API response (db.ts)
  blurhash?: string;
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
  aiTags?: string[];
  aiDescription?: string;
  // Debug field
  _score?: number;
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
