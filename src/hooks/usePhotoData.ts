import { useState, useEffect, useCallback } from 'react';
import { Photo, Folder, Metadata } from '../types';
import { apiRequest } from '../utils/api';

export function usePhotoData(folderId?: string, viewMode: string = 'normal') {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState<{ trash: number, favorites: number, total: number } | null>(null);
  
  // Cache check
  useEffect(() => {
    const cached = localStorage.getItem('gallery_cache');
    if (cached && photos.length === 0) {
      try {
        const data = JSON.parse(cached);
        if (data && Array.isArray(data.photos)) {
          // If we have cached data, we can use it immediately
          // But we need to filter it if we are in a specific view
          // The cache stores ALL photos usually
          
          // Let's just set the raw data and let the filtering logic below handle it
          // Wait, `setPhotos` here sets the state.
          // If we are in "Trash" view, we shouldn't show all photos.
          // The previous logic filtered `filteredPhotos` from `photos`.
          // So `photos` should be the FULL list.
          
          setPhotos(data.photos);
          if (data.folders) {
              data.folders.sort((a: Folder, b: Folder) => a.name.localeCompare(b.name, 'zh-CN'));
          }
          setFolders(data.folders || []);
          if (data.counts) setCounts(data.counts);
          setLoading(false);
        }
      } catch (e) {
        console.error('Cache parse error', e);
      }
    }
  }, []);

  const fetchData = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams({
        viewMode: viewMode === 'trash' ? 'trash' : 'normal', // Only fetch trash if in trash mode, otherwise fetch normal (which is ALL active)
      });
      // We ignore folderId in fetch, because we want ALL photos to enable fast switching.
      // Unless viewMode is trash, then we fetch trash.

      // Try fetching from API first
      try {
          const res: any = await apiRequest(`/data?${queryParams.toString()}`);
          
          // Sort folders alphabetically by pinyin
          if (res.folders) {
              res.folders.sort((a: Folder, b: Folder) => a.name.localeCompare(b.name, 'zh-CN'));
          }

          setFolders(res.folders || []);
          setPhotos(res.photos || []);
          if (res.counts) {
              setCounts(res.counts);
          }
          
          // Update cache
          try {
              if (viewMode === 'normal') {
                   localStorage.setItem('gallery_cache', JSON.stringify(res));
              }
          } catch (e) { console.warn('Cache failed', e); }
      } catch (networkError) {
          // If network fails, fallback to cache
          console.warn('Network failed, falling back to cache', networkError);
          const cached = localStorage.getItem('gallery_cache');
          if (cached) {
              const data = JSON.parse(cached);
              // Sort cached folders too
              if (data.folders) {
                  data.folders.sort((a: Folder, b: Folder) => a.name.localeCompare(b.name, 'zh-CN'));
              }
              setFolders(data.folders || []);
              setPhotos(data.photos || []);
              if (data.counts) setCounts(data.counts);
          } else {
              throw networkError; // Throw if no cache available
          }
      }

    } catch (err: any) {
      console.error('Fetch error', err);
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [viewMode]); // Re-fetch only if viewMode changes (Normal <-> Trash)

  // Initial Load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]); 

  // Filter photos based on viewMode and folderId (Client-Side)
  const filteredPhotos = photos.filter(p => {
      // 1. Trash View
      if (viewMode === 'trash') {
          return p.deletedAt; 
      }
      
      // 2. Normal View (Active Photos)
      if (p.deletedAt) return false;

      // 3. Favorites View
      if (viewMode === 'favorites') {
          return p.isFavorite;
      }

      // 4. Folder View
      if (folderId) {
          return p.folder === folderId;
      }

      // 5. All Photos
      return true;
  });

  return {
    photos: filteredPhotos,
    allPhotos: photos, // Exposed for search/other needs
    folders,
    loading,
    error,
    hasMore: false, // No pagination
    loadMore: () => {}, // No-op
    refresh: () => fetchData(true),
    setPhotos, 
    counts
  };
}
