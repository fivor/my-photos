// Search Worker for client-side sorting/filtering if needed
// Currently basic sort, but can be extended

self.onmessage = (e: MessageEvent) => {
    const { photos, criterion } = e.data;
    
    if (!photos || !Array.isArray(photos)) {
        self.postMessage([]);
        return;
    }

    const sorted = [...photos].sort((a, b) => {
        // Example complex sort
        // 1. Semantic Score
        if (a._score !== undefined && b._score !== undefined) {
            if (a._score !== b._score) return b._score - a._score;
        }
        
        // 2. Date
        const dateA = new Date(a.date || a.uploadedAt).getTime();
        const dateB = new Date(b.date || b.uploadedAt).getTime();
        return dateB - dateA;
    });

    self.postMessage(sorted);
};
