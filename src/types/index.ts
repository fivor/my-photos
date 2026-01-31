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
