import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Photo, Folder } from '../types';
import { PhotoSlider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { format, parseISO } from 'date-fns';
import { getPhotoUrl, isHeic, formatFileSize } from '../utils/image';
import { useAuth } from '../context/AuthContext';
import { Check, Download, Share2, Trash2, FolderInput, ZoomIn, ZoomOut, Heart, RotateCcw, AlertTriangle, Edit2, Check as CheckIcon, X as XIcon } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useConfig } from '../context/ConfigContext';
import { zhCN, enUS } from 'date-fns/locale';
import { HeicImage } from './HeicImage';
import { Virtuoso } from 'react-virtuoso';
import { usePinch } from '@use-gesture/react';
import { decode } from 'blurhash';

interface Props {
  photos: Photo[];
  folders: Folder[];
  onPhotoUpdate?: () => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectPhoto?: (id: string) => void;
  onDelete?: (id: string) => void;
  viewMode?: 'normal' | 'favorites' | 'trash' | 'map';
  onRestore?: (id: string) => void;
  onDeleteForever?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onLightboxChange?: (isOpen: boolean) => void;
  targetPhotoId?: string | null;
  onClearTarget?: () => void;
  onUpdatePhotoDetail?: (id: string, updates: Partial<Photo>) => void;
  headerContent?: React.ReactNode;
}

// BlurHash Canvas Component
const BlurhashCanvas = ({ hash, width = 32, height = 32, className }: { hash: string, width?: number, height?: number, className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && hash) {
      try {
        const pixels = decode(hash, width, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.createImageData(width, height);
          imageData.data.set(pixels);
          ctx.putImageData(imageData, 0, 0);
        }
      } catch (e) {
        console.error('Blurhash decode error', e);
      }
    }
  }, [hash, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className={className} />;
};

const PhotoOverlayContent = ({ photo, role, onSave }: { photo: Photo, role: string | null, onSave: (updates: Partial<Photo>) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [desc, setDesc] = useState(photo.description || '');
  const [date, setDate] = useState(photo.date || photo.uploadedAt);

  // Reset when photo changes
  useEffect(() => {
    setDesc(photo.description || '');
    setDate(photo.date || photo.uploadedAt);
    setIsEditing(false);
  }, [photo.id]);

  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSave({ description: desc, date: date });
    setIsEditing(false);
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <div className="pointer-events-auto w-full max-w-lg" onClick={stopPropagation}>
        <form onSubmit={handleSave} className="flex flex-col gap-2 bg-black/50 p-4 rounded-lg backdrop-blur-md border border-white/10">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="增加一段描述..."
            className="w-full bg-black/40 text-white rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none h-20"
            autoFocus
          />
          <div className="flex gap-2 items-center bg-black/40 rounded p-1">
            <input
              ref={dateInputRef}
              type="date"
              value={date ? date.substring(0, 10) : ''}
              onChange={(e) => {
                 // Preserve time if editing date, or default to T00:00:00
                 if (e.target.value) {
                     const existingTime = date ? date.substring(10) : 'T12:00:00.000Z';
                     setDate(e.target.value + existingTime);
                 }
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="bg-transparent text-white text-xs focus:outline-none flex-1 [color-scheme:dark] px-2"
            />
            <div 
              className="flex items-center gap-1 px-2 cursor-pointer"
              onClick={() => dateInputRef.current?.showPicker()}
            >
               <span className="text-white text-xs hover:text-[#1890ff] transition-colors">日历</span>
            </div>
            <button type="button" onClick={() => setIsEditing(false)} className="p-1 hover:bg-white/10 rounded text-gray-300">
               <XIcon size={16} />
            </button>
            <button type="submit" className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-white">
               <CheckIcon size={16} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto" onClick={stopPropagation}>
      <div 
        className={`group flex flex-col items-start ${role === 'admin' ? 'cursor-pointer hover:bg-black/20 rounded p-2 -ml-2 transition-colors' : ''}`}
        onClick={() => role === 'admin' && setIsEditing(true)}
        title={role === 'admin' ? "Click to edit details" : undefined}
      >
         {desc ? (
             <p className="text-white/90 text-base font-medium mb-1 drop-shadow-md whitespace-pre-wrap">{desc}</p>
         ) : null}

         <div className="flex items-center gap-2 mb-2 min-h-[20px]">
             <span className="text-white/70 text-xs drop-shadow-md">
                {format(parseISO(date || photo.uploadedAt), 'yyyy-MM-dd')}
             </span>
             {role === 'admin' && <Edit2 size={14} className="text-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />}
         </div>
         
         <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300">
            {photo.location?.name && (
                <span className="drop-shadow-md">📍 {photo.location.name}</span>
            )}
            {photo.aiTags && photo.aiTags.length > 0 && (
                 <div className="flex gap-2 flex-wrap">
                    {photo.aiTags.map(tag => (
                        <span key={tag} className="bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10">{tag}</span>
                    ))}
                 </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default function Timeline({ photos, folders, onPhotoUpdate, isSelectionMode, selectedIds, onSelectPhoto, onDelete, viewMode = 'normal', onRestore, onDeleteForever, onToggleFavorite, onLightboxChange, targetPhotoId, onClearTarget, onUpdatePhotoDetail, isSearching = false, headerContent }: Props & { isSearching?: boolean, headerContent?: React.ReactNode }) {
  const { role } = useAuth();
  const { language } = useConfig();
  
  // Responsive Columns
  const [columns, setColumns] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial column calculation
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumns(3);
      else if (width < 768) setColumns(4);
      else if (width < 1024) setColumns(5);
      else if (width < 1280) setColumns(6);
      else setColumns(7);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Pinch Gesture
  usePinch(({ offset: [s], memo }) => {
    // memo stores the initial column count when gesture starts
    if (!memo) memo = columns;
    
    // Calculate new columns based on scale
    // Scaling up (s > 1) means fewer columns (zoom in)
    // Scaling down (s < 1) means more columns (zoom out)
    
    // We map scale to column delta.
    // This is a bit tricky to get right feel.
    // Let's just use the scale factor directly on the memoized value
    // If scale is 2 (zoomed in), we want half the columns?
    // columns = initial / scale
    
    const target = Math.round(memo / s);
    const clamped = Math.max(2, Math.min(10, target));
    
    if (clamped !== columns) {
        setColumns(clamped);
    }
    
    return memo;
  }, { 
    target: containerRef,
    eventOptions: { passive: false }
  });

  // Group photos by date
  const { groupedPhotos, sortedDates, displayPhotos, flatRows } = useMemo(() => {
    if (isSearching) {
        const searchAll = photos;
        const searchRows: Array<{ type: 'header', date: string } | { type: 'photos', items: Photo[], date: string }> = [];
        const title = language === 'zh' ? '搜索结果' : 'Search Results';
        // Check if all photos belong to "我们俩" folder
        // We can check if the first photo belongs to it, and assume the rest do if we are in this special mode?
        // Or better, check if the "520" logic was applied.
        // But Timeline doesn't know about "520".
        // Let's rely on the folder name check of the first photo as a heuristic, 
        // OR just check if the search query was passed? No, we don't have query here.
        
        // Let's use the folder name heuristic.
        // If photos are filtered to "我们俩", display that title.
        const isLoveAlbum = searchAll.length > 0 && 
                            searchAll.every(p => {
                                const folder = folders.find(f => f.id === p.folder);
                                return folder && folder.name === '我们俩';
                            });

        const displayTitle = isLoveAlbum ? '我们俩' : '搜索结果';
        
        // Just one big group
        // We can use a dummy date or title
        searchRows.push({ type: 'header', date: displayTitle });
        
        for (let i = 0; i < searchAll.length; i += columns) {
            searchRows.push({
                type: 'photos',
                items: searchAll.slice(i, i + columns),
                date: displayTitle
            });
        }
        
        return { 
            groupedPhotos: { [displayTitle]: searchAll }, 
            sortedDates: [displayTitle],
            displayPhotos: searchAll, 
            flatRows: searchRows 
        };
    }

    const dateGrouped = photos.reduce((acc, photo) => {
      // 1. Get raw date string or fallback
      const rawDate = photo.date || photo.uploadedAt;
      let dateKey = '';

      try {
        // 2. Parse properly to Date object
        const dateObj = parseISO(rawDate);
        if (isNaN(dateObj.getTime())) {
             // Fallback to today if invalid
             dateKey = format(new Date(), 'yyyy-MM-dd');
        } else {
             // 3. Format to local YYYY-MM-DD for grouping
             dateKey = format(dateObj, 'yyyy-MM-dd');
        }
      } catch (e) {
        dateKey = format(new Date(), 'yyyy-MM-dd');
      }

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(photo);
      return acc;
    }, {} as Record<string, Photo[]>);

    // Sort photos within each date group by time (descending)
    Object.keys(dateGrouped).forEach(date => {
      dateGrouped[date].sort((a, b) => {
        const dateA = new Date(a.date || a.uploadedAt).getTime();
        const dateB = new Date(b.date || b.uploadedAt).getTime();
        return dateB - dateA;
      });
    });

    const dates = Object.keys(dateGrouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    const allFlat = dates.flatMap(date => dateGrouped[date]);
    
    // Flatten for Virtuoso
    const rows: Array<{ type: 'header', date: string } | { type: 'photos', items: Photo[], date: string }> = [];
    
    dates.forEach(date => {
      rows.push({ type: 'header', date });
      const datePhotos = dateGrouped[date];
      for (let i = 0; i < datePhotos.length; i += columns) {
        rows.push({
          type: 'photos',
          items: datePhotos.slice(i, i + columns),
          date
        });
      }
    });

    return { groupedPhotos: dateGrouped, sortedDates: dates, displayPhotos: allFlat, flatRows: rows };
  }, [photos, columns]);

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Handle Target Photo (Deep Link / Memory Click)
  useEffect(() => {
    if (targetPhotoId) {
      const index = displayPhotos.findIndex(p => p.id === targetPhotoId);
      if (index !== -1) {
        setLightboxIndex(index);
        setIsLightboxOpen(true);
        onClearTarget?.();
      }
    }
  }, [targetPhotoId, displayPhotos, onClearTarget]);

  // Keyboard Navigation & Shortcuts for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Only handle delete if user is admin
      if (role === 'admin' && (e.key === 'Delete' || e.key === 'Backspace')) {
         const currentPhoto = displayPhotos[lightboxIndex];
         if (currentPhoto) {
             if (viewMode === 'trash') {
                 onDeleteForever?.(currentPhoto.id);
             } else {
                 handleDelete(currentPhoto.id);
             }
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, lightboxIndex, displayPhotos, role, viewMode]);

  // Sync with parent
  useEffect(() => {
    onLightboxChange?.(isLightboxOpen);
  }, [isLightboxOpen, onLightboxChange]);

  // Date formatting helpers
  const dateFormat = language === 'zh' ? 'yyyy年M月d日' : 'MMMM d, yyyy';
  const locale = language === 'zh' ? zhCN : enUS;

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || 'photo';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      alert('链接已复制到剪贴板！');
    });
  };

  const handleDelete = async (photoId: string) => {
    if (onDelete) {
      onDelete(photoId);
      return;
    }
    if (!confirm('温馨提示：确定要删除这张照片吗？')) return;
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_photo', data: { id: photoId } })
      });
      if (onPhotoUpdate) onPhotoUpdate();
      setIsLightboxOpen(false);
    } catch (e) {
      alert('删除照片失败');
    }
  };

  const handleMove = async (photoId: string, targetFolderId: string) => {
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'move_photo', data: { id: photoId, targetFolderId } })
      });
      if (onPhotoUpdate) onPhotoUpdate();
      setIsLightboxOpen(false);
    } catch (e) {
      alert('移动照片失败');
    }
  };

  const renderPhotoItem = (photo: Photo) => {
    const fixedUrl = getPhotoUrl(photo.url);
    const isHeicFile = isHeic(photo.filename || photo.url) && !photo.thumbnailUrl;
    const thumbnailUrl = photo.thumbnailUrl ? getPhotoUrl(photo.thumbnailUrl) : undefined;
    const isLegacyHeic = isHeicFile && !photo.hasOriginal;

    return (
      <div 
        key={photo.id} 
        className={`group relative aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-lg transition-all duration-200 ${isSelectionMode && selectedIds?.has(photo.id) ? 'ring-4 ring-blue-500' : ''}`}
        onClick={() => {
          if (isSelectionMode) {
            onSelectPhoto?.(photo.id);
          } else {
            // Find index in flat list
            const index = displayPhotos.findIndex(p => p.id === photo.id);
            if (index !== -1) {
              setLightboxIndex(index);
              setIsLightboxOpen(true);
            }
          }
        }}
      >
        {/* Debug Score */}
        {(photo as any)._score !== undefined && (
            <div className="absolute top-1 left-1 z-40 bg-black/70 text-white text-[10px] px-1 rounded">
                {((photo as any)._score * 100).toFixed(1)}%
            </div>
        )}

        {/* BlurHash Placeholder */}
        {photo.blurhash && (
           <div className="absolute inset-0 z-0">
             <BlurhashCanvas hash={photo.blurhash} className="w-full h-full object-cover" />
           </div>
        )}

        {isLegacyHeic ? (
          <HeicImage 
            src={fixedUrl} 
            alt={photo.description || 'Photo'} 
            className="w-full h-full object-cover transition-transform group-hover:scale-105 relative z-10"
          />
        ) : (
          <img
            src={thumbnailUrl || fixedUrl}
            alt={photo.description || 'Photo'}
            className={`w-full h-full object-cover transition-all duration-500 opacity-0 group-hover:scale-105 relative z-10`}
            loading="lazy"
            onLoad={(e) => {
               const img = e.target as HTMLImageElement;
               img.classList.remove('opacity-0');
            }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (thumbnailUrl && img.src === thumbnailUrl) {
                 // Try loading original if thumbnail fails
                 img.src = fixedUrl;
                 return;
              }
              // If both fail, keep it hidden (showing background color)
              // OR show a broken image icon?
              // The user said: "即使最下面的只有部分，也要显示照片缩略图"
              // Maybe the issue is Virtuoso not rendering it?
              // Or maybe lazy loading threshold?
              // Let's remove display:none to see if browser shows broken image icon at least,
              // or rely on the background color.
              // But if I hide it, it's just a gray box.
              // Let's NOT hide it completely, maybe show a placeholder icon.
              img.style.display = 'none'; 
            }}
          />
        )}
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/20 transition-colors z-20" />
        
        {/* Selection Overlay */}
        {isSelectionMode && (
          <div className="absolute top-2 right-2 z-30">
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds?.has(photo.id) ? 'bg-blue-500 border-blue-500' : 'bg-black/30 border-white hover:bg-black/50'}`}>
              {selectedIds?.has(photo.id) && <Check size={14} className="text-white" />}
            </div>
          </div>
        )}

        {/* Favorite Indicator */}
        {!isSelectionMode && photo.isFavorite && (
          <div className="absolute top-2 right-2 z-30">
             <Heart size={16} className="text-red-500 fill-current drop-shadow-md" />
          </div>
        )}

        {/* Hover Info - Desktop Only */}
        {!isSelectionMode && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block z-30">
             {photo.description && (
               <div className="text-[10px] text-gray-200 truncate">
                 {photo.description}
               </div>
             )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="h-full w-full touch-pan-y">
      {/* DEBUG: Trash View Data Inspector */}
      {viewMode === 'trash' && (
          <div className="bg-black text-green-400 p-4 font-mono text-xs overflow-auto max-h-60 border-b border-gray-700">
              <p>DEBUG TRASH MODE</p>
              <p>Total Photos in State: {photos.length}</p>
              <p>Is Selection Mode: {isSelectionMode ? 'Yes' : 'No'}</p>
              <pre>
                  {JSON.stringify(photos.slice(0, 2).map(p => ({
                      id: p.id,
                      deletedAt: p.deletedAt,
                      date: p.date
                  })), null, 2)}
              </pre>
          </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>No photos found. Upload some photos to get started!</p>
        </div>
      ) : (
        <Virtuoso
        data={flatRows}
        className="h-full w-full custom-scrollbar"
        // Increase overscan to render more items outside the viewport (default is usually small)
        overscan={1000} 
        // Add footer to ensure bottom padding for the last item to be fully visible if partially cut off
        components={{
            Header: headerContent ? () => <div>{headerContent}</div> : undefined,
            Footer: () => <div className="h-32" /> // Extra space at bottom
        }}
        itemContent={(index, row) => {
          if (row.type === 'header') {
            if (isSearching) {
                return (
                  <div className="py-4 px-2 sm:px-4 sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-sm">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                      Search Results ({photos.length})
                    </h3>
                  </div>
                );
            }

            let parsedDate;
            try {
                parsedDate = parseISO(row.date);
                // Check if date is valid
                if (isNaN(parsedDate.getTime())) {
                    throw new Error('Invalid date');
                }
            } catch (e) {
                // Fallback for invalid dates
                parsedDate = new Date();
            }

            return (
              <div className="py-4 px-2 sm:px-4 sticky top-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-sm">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                  {format(parsedDate, dateFormat, { locale })}
                </h3>
              </div>
            );
          } else {
            return (
              <div 
                className="grid gap-0.5 sm:gap-2 px-0.5 sm:px-4 mb-0.5 sm:mb-2"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {row.items.map(photo => renderPhotoItem(photo))}
                {/* Fill empty slots with placeholders if this is the last row? 
                    Actually CSS Grid handles this naturally, leaving empty space.
                    But if the user wants to see "thumbnails" even if empty? 
                    No, the user says "partially displayed".
                    Ah, maybe the user means lazy loading is too aggressive or the item height is not enough?
                    
                    Wait, looking at the user screenshot, there is a WHITE BOX with red border.
                    "Below: a blank placeholder area for a photo thumbnail (white rectangle with a red border, rounded corners). No image displayed."
                    
                    This means the image FAILED to load or is not visible.
                    My code has `onError` handler that hides the image: `img.style.display = 'none';`.
                    If display is none, then the parent div (bg-gray-200) shows up.
                    
                    If the user wants to see "thumbnails" even if partially loaded?
                    The issue might be that `onError` is hiding it too aggressively or `opacity-0` is not removed.
                    
                    Let's adjust the image rendering logic.
                */}
              </div>
            );
          }
        }}
      />

      {/* Lightbox */}
      <PhotoSlider
        images={displayPhotos.map(p => ({ 
            src: getPhotoUrl(p.url), 
            key: p.id,
            intro: p.description
        }))}
        visible={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        toolbarRender={({ rotate, onRotate, scale, onScale }) => {
            const photoData = displayPhotos[lightboxIndex];
            if (!photoData) return null;

            return (
              <div className="flex gap-4 mx-4 items-center">
                 {/* Custom Toolbar similar to previous implementation */}
                 {viewMode !== 'trash' && (
                  <>
                    <button onClick={() => onScale(scale + 0.5)} title="Zoom In" className="text-white hover:text-blue-400">
                      <ZoomIn size={20} />
                    </button>
                    <button onClick={() => onScale(Math.max(0.5, scale - 0.5))} title="Zoom Out" className="text-white hover:text-blue-400">
                      <ZoomOut size={20} />
                    </button>
                    
                    <button onClick={() => handleDownload(getPhotoUrl(photoData.url))} title="Download" className="text-white hover:text-blue-400">
                      <Download size={20} />
                    </button>
                    {photoData.hasOriginal && (
                       <button 
                         onClick={() => handleDownload(getPhotoUrl(photoData.url) + '-original')} 
                         title={`Download Original`}
                         className="text-white hover:text-blue-400 flex items-center gap-1"
                       >
                          <Download size={20} />
                          <span className="text-xs font-bold">RAW</span>
                       </button>
                    )}
                    <button onClick={() => handleShare(getPhotoUrl(photoData.url))} title="Share" className="text-white hover:text-blue-400">
                      <Share2 size={20} />
                    </button>
                  </>
                )}

                {role === 'admin' && (
                  <>
                    
                    {viewMode === 'trash' ? (
                      <>
                         <button onClick={() => onRestore?.(photoData.id)} title="恢复" className="text-white hover:text-green-400">
                           <RotateCcw size={20} />
                         </button>
                         <button onClick={() => onDeleteForever?.(photoData.id)} title="永久删除" className="text-white hover:text-red-400">
                           <AlertTriangle size={20} />
                         </button>
                      </>
                    ) : (
                      <>
                        <div className="relative flex items-center group">
                            <button className="text-white hover:text-blue-400" title="Move to album">
                                <FolderInput size={20} />
                            </button>
                            <select 
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                if (e.target.value) handleMove(photoData.id, e.target.value);
                              }}
                              value={photoData.folder}
                            >
                              {folders.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')).map(f => (
                                <option key={f.id} value={f.id} disabled={f.id === photoData.folder}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                        </div>

                        <button onClick={() => handleDelete(photoData.id)} title="Delete" className="text-white hover:text-red-400">
                            <Trash2 size={20} />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            );
        }}
  // Custom Overlay for Details
        overlayRender={(props) => {
             const currentPhoto = displayPhotos[props.index];
             if (!currentPhoto) return null;

             return (
               <>
                 {/* Bottom Overlay: Info, Edit & Favorite */}
                 <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-50">
                    <div className="max-w-7xl mx-auto pb-4 flex justify-between items-end">
                        <div className="flex-1 mr-4">
                            <PhotoOverlayContent 
                               photo={currentPhoto} 
                               role={role} 
                               onSave={(updates) => onUpdatePhotoDetail?.(currentPhoto.id, updates)} 
                            />
                        </div>

                        {viewMode !== 'trash' && (
                            <div className="pointer-events-auto mb-2">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFavorite?.(currentPhoto.id);
                                    }}
                                    title="Favorite" 
                                    className={`p-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 transition-all ${currentPhoto.isFavorite ? 'text-red-500' : 'text-white'}`}
                                >
                                    <Heart size={24} fill={currentPhoto.isFavorite ? 'currentColor' : 'none'} />
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
               </>
             );
        }}
      />
    </div>
  );
}