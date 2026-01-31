import React from 'react';
import { Photo, Folder } from '../types';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { format, parseISO } from 'date-fns';
import { getPhotoUrl, isHeic, formatFileSize } from '../utils/image';
import { useAuth } from '../context/AuthContext';
import { Check, Download, Share2, Trash2, FolderInput, ZoomIn, ZoomOut, Heart, RotateCcw, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useConfig } from '../context/ConfigContext';
import { zhCN, enUS } from 'date-fns/locale';
import { HeicImage } from './HeicImage';
import { PhotoDetailsOverlay } from './PhotoDetailsOverlay';

interface Props {
  photos: Photo[];
  folders: Folder[];
  onPhotoUpdate?: () => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectPhoto?: (id: string) => void;
  onDelete?: (id: string) => void;
  viewMode?: 'normal' | 'favorites' | 'trash';
  onRestore?: (id: string) => void;
  onDeleteForever?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onLightboxChange?: (isOpen: boolean) => void;
}

export default function Timeline({ photos, folders, onPhotoUpdate, isSelectionMode, selectedIds, onSelectPhoto, onDelete, viewMode = 'normal', onRestore, onDeleteForever, onToggleFavorite, onLightboxChange }: Props) {
  const { role } = useAuth();
  const { language } = useConfig();
  
  // Group photos by date
  const groupedPhotos = photos.reduce((acc, photo) => {
    const date = photo.date ? photo.date : photo.uploadedAt.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedPhotos).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Flatten photos for consistent indexing in Lightbox
  const displayPhotos = sortedDates.flatMap(date => groupedPhotos[date]);

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
      // Close lightbox after delete to update view and prevent sidebar state issues
      onLightboxChange?.(false);
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
      // Close lightbox after move to update view and prevent sidebar state issues
      onLightboxChange?.(false);
    } catch (e) {
      alert('移动照片失败');
    }
  };

  const renderPhotoContent = (photo: Photo, fixedUrl: string, isHeicFile: boolean) => {
    // For new HEIC uploads (which are actually WebP), we should treat them as normal images
    // in the grid view too, to avoid using HeicImage component which is heavy and async.
    const isLegacyHeic = isHeicFile && !photo.hasOriginal;
    const shouldUseHeicComponent = isLegacyHeic;

    return (
    <div className={`group relative aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-lg transition-all duration-200 ${isSelectionMode && selectedIds?.has(photo.id) ? 'ring-4 ring-blue-500' : ''}`}>
      {shouldUseHeicComponent ? (
        <HeicImage 
          src={fixedUrl} 
          alt={photo.description || 'Photo'} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <img
          src={photo.thumbnailUrl ? getPhotoUrl(photo.thumbnailUrl) : fixedUrl}
          alt={photo.description || 'Photo'}
          className={`w-full h-full object-cover transition-all duration-500 opacity-0 group-hover:scale-105`}
          loading="lazy"
          onLoad={(e) => {
             const img = e.target as HTMLImageElement;
             img.classList.remove('opacity-0');
          }}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            // If we were trying to load a generated thumbnail and it failed, fallback to original
            if (photo.thumbnailUrl && img.src === getPhotoUrl(photo.thumbnailUrl)) {
               img.src = fixedUrl;
               return;
            }
            img.style.display = 'none';
            img.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-gray-200', 'dark:bg-gray-800');
            const span = document.createElement('span');
            span.innerText = 'Failed to load';
            span.className = 'text-xs text-red-500 dark:text-red-400';
            img.parentElement?.appendChild(span);
          }}
        />
      )}
      
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/20 transition-colors" />
      
      {/* Selection Overlay */}
      {isSelectionMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds?.has(photo.id) ? 'bg-blue-500 border-blue-500' : 'bg-black/30 border-white hover:bg-black/50'}`}>
            {selectedIds?.has(photo.id) && <Check size={14} className="text-white" />}
          </div>
        </div>
      )}

      {/* Favorite Indicator */}
      {!isSelectionMode && photo.isFavorite && (
        <div className="absolute top-2 right-2 z-10">
           <Heart size={16} className="text-red-500 fill-current drop-shadow-md" />
        </div>
      )}

      {/* Hover Info - Desktop Only */}
      {!isSelectionMode && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
           <div className="text-xs text-white font-medium truncate">
             {photo.date || format(parseISO(photo.uploadedAt), 'yyyy-MM-dd')}
           </div>
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

  if (photos.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>No photos found. Upload some photos to get started!</p>
      </div>
    );
  }

  return (
    <PhotoProvider
      onVisibleChange={(visible) => onLightboxChange?.(visible)}
      overlayRender={(overlayProps) => (
        <PhotoDetailsOverlay 
          {...overlayProps} 
          photos={displayPhotos} 
          role={role} 
          onUpdate={onPhotoUpdate} 
        />
      )}
      toolbarRender={(toolbarProps) => {
        // @ts-ignore
        const currentSrc = toolbarProps.images[toolbarProps.index]?.src;
        // Find photo by index
        const photoData = displayPhotos[toolbarProps.index];
        
        return (
          <div className="flex gap-4 mx-4 items-center">
            {/* Zoom Controls - Hide in trash mode */}
            {viewMode !== 'trash' && (
              <>
                <button onClick={() => toolbarProps.onScale(toolbarProps.scale + 0.5)} title="Zoom In" className="text-white hover:text-blue-400">
                  <ZoomIn size={20} />
                </button>
                <button onClick={() => toolbarProps.onScale(Math.max(0.5, toolbarProps.scale - 0.5))} title="Zoom Out" className="text-white hover:text-blue-400">
                  <ZoomOut size={20} />
                </button>

                <div className="w-px h-6 bg-gray-600 mx-2"></div>

                <button onClick={() => currentSrc && handleDownload(currentSrc)} title="Download" className="text-white hover:text-blue-400">
                  <Download size={20} />
                </button>
                {photoData.hasOriginal && (
                   <button 
                     onClick={() => handleDownload(getPhotoUrl(photoData.url) + '-original')} 
                     title={`Download Original ${photoData.originalSize ? '(' + formatFileSize(photoData.originalSize) + ')' : ''}`}
                     className="text-white hover:text-blue-400 flex items-center gap-1"
                   >
                      <Download size={20} />
                      <span className="text-xs font-bold">RAW</span>
                   </button>
                )}
                <button onClick={() => currentSrc && handleShare(currentSrc)} title="Share" className="text-white hover:text-blue-400">
                  <Share2 size={20} />
                </button>
              </>
            )}
            
            {role === 'admin' && (
              <>
                {viewMode !== 'trash' && <div className="w-px h-6 bg-gray-600 mx-2"></div>}
                
                {viewMode === 'trash' ? (
                  <>
                     <button 
                       onClick={() => {
                         onRestore?.(photoData.id);
                         onLightboxChange?.(false);
                       }} 
                       title="恢复" 
                       className="text-white hover:text-green-400"
                     >
                       <RotateCcw size={20} />
                     </button>
                     <button 
                       onClick={() => {
                         onDeleteForever?.(photoData.id);
                         onLightboxChange?.(false);
                       }} 
                       title="永久删除" 
                       className="text-white hover:text-red-400"
                     >
                       <AlertTriangle size={20} />
                     </button>
                  </>
                ) : (
                  <>
                    {role === 'admin' && (
                      <button 
                        onClick={() => {
                          onToggleFavorite?.(photoData.id);
                          if (viewMode === 'favorites') {
                            onLightboxChange?.(false);
                          }
                        }} 
                        title="Favorite (Ctrl+Shift+F)" 
                        className={`hover:text-red-500 transition-colors ${photoData.isFavorite ? 'text-red-500' : 'text-white'}`}
                      >
                        <Heart size={20} fill={photoData.isFavorite ? 'currentColor' : 'none'} />
                      </button>
                    )}

                    {role === 'admin' && (
                      <div className="relative flex items-center group">
                        <button className="text-white hover:text-blue-400" title="Move to album">
                            <FolderInput size={20} />
                        </button>
                        <select 
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleMove(photoData.id, e.target.value);
                            }
                          }}
                          value={photoData.folder}
                          title="Move to album"
                        >
                          {folders.map(f => (
                            <option key={f.id} value={f.id} disabled={f.id === photoData.folder}>
                              {f.name} {f.id === photoData.folder ? '(Current)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {role === 'admin' && (
                      <button onClick={() => handleDelete(photoData.id)} title="Delete" className="text-white hover:text-red-400">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        );
      }}
    >
      <div className="space-y-8">
        {sortedDates.map(date => (
          <div key={date} id={`date-${date}`} className="scroll-mt-24 relative">
            <h3 
              className="text-xl font-bold mb-4 sticky top-0 z-[100] py-2 px-4 transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--date-text-color)',
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {format(parseISO(date), dateFormat, { locale })}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-0.5 sm:gap-2">
              {groupedPhotos[date].map(photo => {
                const fixedUrl = getPhotoUrl(photo.url);
                const isHeicFile = isHeic(photo.filename || photo.url) && !photo.thumbnailUrl;
                const thumbnailUrl = photo.thumbnailUrl ? getPhotoUrl(photo.thumbnailUrl) : undefined;

                if (isSelectionMode) {
                  return (
                    <div key={photo.id} onClick={() => onSelectPhoto?.(photo.id)}>
                      {renderPhotoContent(photo, fixedUrl, isHeicFile)}
                    </div>
                  );
                }

                // Normal image handling (jpg, png, webp, and converted HEIC)
                // Note: We treat HEIC as normal image if it has been converted (which new uploads are)
                // But `isHeicFile` logic above checks extension. 
                // However, since we now convert to WebP on upload, the URL might still have .heic extension 
                // but Content-Type is image/webp. Browsers handle this fine in <img> tag.
                // The ONLY case we need HeicImage is for OLD uploads that are actual HEIC files.
                // Let's try to force using <img> tag first even for HEIC, and if it fails (onerror), fallback to HeicImage?
                // Actually, the issue is that `isHeic` utility checks extension.
                
                // If it's a new upload (hasOriginal=true), it means we have a compressed WebP version available at the main URL.
                // So we can treat it as a normal image regardless of extension.
                const isLegacyHeic = isHeicFile && !photo.hasOriginal;

                // Fallback Logic for HEIC:
                // We ALWAYS try to render as a normal image first (using src).
                // If it's a legacy HEIC, we pass a special custom renderer via the `render` prop ONLY if needed.
                // But PhotoView doesn't support conditional `src` vs `render` well in the same loop if we want to be dynamic.
                // However, we know `isLegacyHeic` status.
                
                // CRITICAL FIX: Even for legacy HEIC, let's use the HeicImage component INSIDE the render prop,
                // BUT we must ensure the HeicImage component is actually capable of displaying.
                // If HeicImage is failing (black screen), it might be because of the container size or z-index.
                
                // Let's try a different approach for Legacy HEIC: 
                // Don't use `render` prop which is complex. Use `src` but point to a thumbnail if available, 
                // and let the HeicImage load in a separate overlay? No, that's messy.
                
                // Revert to reliable logic:
                // 1. If it's NOT legacy HEIC (it's JPG/PNG/WebP/Converted HEIC), use standard PhotoView with src.
                // 2. If it IS legacy HEIC, use PhotoView with `render` prop containing HeicImage.
                
                if (!isLegacyHeic) {
                  return (
                    <PhotoView 
                      key={photo.id} 
                      src={fixedUrl}
                      // @ts-ignore
                      loadingElement={
                        <div className="flex items-center justify-center w-full h-full relative">
                           {thumbnailUrl && (
                             <img 
                               src={thumbnailUrl} 
                               className="absolute inset-0 w-full h-full object-contain blur-md opacity-50" 
                               alt="thumbnail"
                             />
                           )}
                           <div className="z-10 flex flex-row items-center gap-2 bg-black/40 px-4 py-2 rounded-lg backdrop-blur-md">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span className="text-white text-xs font-medium">加载原图中...</span>
                           </div>
                        </div>
                      }
                    >
                      {renderPhotoContent(photo, fixedUrl, isHeicFile)}
                    </PhotoView>
                  );
                }

                // Legacy HEIC handling
                return (
                  <PhotoView 
                    key={photo.id} 
                    render={({ attrs, scale }) => {
                        // FORCE override transform origin and position
                        // If transform is present, we must respect it but ensure origin is top-left or center?
                        // PhotoView usually uses translate3d + scale.
                        // The issue is likely that the `div` we return has 0x0 size initially or position absolute issues.
                        
                        const containerStyle: React.CSSProperties = {
                           ...attrs.style,
                           width: '100vw', // Force viewport width
                           height: '100vh', // Force viewport height
                           position: 'absolute',
                           top: 0,
                           left: 0,
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           transformOrigin: '0 0', // Crucial for PhotoView transforms
                        };
                        
                        return (
                           <div {...attrs} className={attrs.className} style={containerStyle}>
                               <HeicImage 
                                 src={fixedUrl} 
                                 alt="Full" 
                                 className="max-w-full max-h-full object-contain pointer-events-none" 
                               />
                           </div>
                        );
                    }}
                  >
                    {renderPhotoContent(photo, fixedUrl, isHeicFile)}
                  </PhotoView>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PhotoProvider>
  );
}
