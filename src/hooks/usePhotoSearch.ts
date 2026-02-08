import { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';
import { apiRequest } from '../utils/api';

export function usePhotoSearch(allPhotos: Photo[], folderId?: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Photo[]>([]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // Special "520" logic (Client-side bypass)
        if (searchQuery.includes('520')) {
            setIsSearching(false);
            return; 
        }

        // Call Backend Search
        const res = await apiRequest<{ results: Photo[], debug: any }>('/search', {
            method: 'POST',
            body: JSON.stringify({ query: searchQuery, limit: 50 })
        });
        
        if (res.results) {
            setSearchResults(res.results);
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoized result getter
  const getDisplayPhotos = (defaultPhotos: Photo[]) => {
      if (searchQuery && searchQuery.length >= 2) {
          // Special "520" Logic
          if (searchQuery.includes('520')) {
             // We assume "我们俩" folder check is done in parent or we can do it here if we had folders
             // For simplicity, we rely on parent to handle "520" specific filtering if it wants,
             // or we just return defaultPhotos (which might be filtered by parent).
             // But actually, the previous logic was complex.
             // Let's return defaultPhotos (which the parent should filter for 520)
             return defaultPhotos;
          }
          return searchResults;
      }
      return defaultPhotos;
  };

  return {
      searchQuery,
      setSearchQuery,
      isSearching,
      searchResults,
      getDisplayPhotos
  };
}
