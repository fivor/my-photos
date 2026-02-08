import { useState, useCallback } from 'react';

export function useSelection<T>(initialSelected: Set<string> = new Set()) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelected);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
        if (prev) setSelectedIds(new Set()); // Clear on exit
        return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
      setSelectedIds(new Set(ids));
      if (!isSelectionMode) setIsSelectionMode(true);
  }, [isSelectionMode]);

  const clearSelection = useCallback(() => {
      setSelectedIds(new Set());
  }, []);

  return {
      isSelectionMode,
      setIsSelectionMode,
      selectedIds,
      setSelectedIds,
      toggleSelectionMode,
      toggleSelect,
      selectAll,
      clearSelection
  };
}
