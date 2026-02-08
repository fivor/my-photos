import { useState, useEffect, useMemo } from 'react';
import { Photo, Folder } from '../types';
import { apiRequest } from '../utils/api';

export function usePhotoSearch(allPhotos: Photo[], folderId?: string, folders: Folder[] = []) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiResults, setAiResults] = useState<Photo[]>([]);

  // 1. Backend AI Search Effect
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2 || searchQuery.includes('520')) {
      setIsSearching(false);
      setAiResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // Call Backend Search
        const res = await apiRequest<{ results: Photo[], debug: any }>('/search', {
            method: 'POST',
            body: JSON.stringify({ query: searchQuery, limit: 50 })
        });
        
        if (res.results) {
            // Requirement 4: Filter by relevance score > 62%
            // The backend returns _score
            const validResults = res.results.filter(p => (p._score || 0) > 0.62);
            setAiResults(validResults);
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Compute Final Display Photos
  // Use useMemo to avoid re-calculating on every render, but depend on searchQuery, aiResults, etc.
  // Actually, getDisplayPhotos is called during render, so it's fine.
  const getDisplayPhotos = (defaultPhotos: Photo[]) => {
      // If NO search query, return default photos (ALL photos)
      if (!searchQuery || searchQuery.length < 2) {
          return defaultPhotos;
      }

      // If search query exists, we MUST return search results ONLY.
      // Even if results are empty.
      
      // Requirement 1: "520" -> "我们俩" album only
      if (searchQuery.includes('520')) {
          const loveFolder = folders.find(f => f.name === '我们俩' || f.name === 'Us' || f.name === 'Love');
          if (loveFolder) {
              return allPhotos.filter(p => p.folder === loveFolder.id);
          }
          return [];
      }

      // Requirement 3: Local Text Search (Description, Date, Location)
      const lowerQuery = searchQuery.toLowerCase();
      const localMatches = allPhotos.filter(p => {
          if (p.description && p.description.toLowerCase().includes(lowerQuery)) return true;
          if (p.location?.name && p.location.name.toLowerCase().includes(lowerQuery)) return true;
          if (p.date && p.date.includes(lowerQuery)) return true;
          if (p.aiTags && p.aiTags.some(t => t.toLowerCase().includes(lowerQuery))) return true;
          return false;
      });

      // Combine Local + AI Results
      const localIds = new Set(localMatches.map(p => p.id));
      const newAiResults = aiResults.filter(p => !localIds.has(p.id));
      
      let combined = [...localMatches, ...newAiResults];

      // Requirement 2: Scope Search (Current Album Only)
      if (folderId) {
          combined = combined.filter(p => p.folder === folderId);
      }

      return combined;
  };

  return {
      searchQuery,
      setSearchQuery,
      isSearching,
      getDisplayPhotos
  };
}
