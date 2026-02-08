import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useTheme } from '../hooks/useTheme';
import { LogOut, Settings as SettingsIcon, Upload as UploadIcon, Sun, Moon, CheckSquare, Trash2, FolderInput, X, Search, Menu, User, RotateCcw, Download } from 'lucide-react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import Timeline from '../components/Timeline';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Sidebar from '../components/Sidebar';
import MapView from '../components/MapView';
import Memories from '../components/Memories';
import { usePhotoData } from '../hooks/usePhotoData';
import { usePhotoSearch } from '../hooks/usePhotoSearch';
import { useSelection } from '../hooks/useSelection';
import { SearchEasterEgg, Slogan } from '../components/EasterEggs';

export default function Gallery() {
  const { logout, role, token: authToken } = useAuth();
  const { siteTitle } = useConfig();
  const { theme, toggleTheme } = useTheme();
  const { id: folderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // View Mode derived from location
  const viewMode = useMemo(() => {
    if (location.pathname === '/favorites') return 'favorites';
    if (location.pathname === '/trash') return 'trash';
    if (location.pathname === '/map') return 'map';
    return 'normal';
  }, [location.pathname]);

  // Hooks
  const { 
      photos, 
      allPhotos, 
      folders, 
      loading, 
      error, 
      loadMore, 
      refresh, 
      setPhotos,
      counts
  } = usePhotoData(folderId, viewMode);

  const { 
      searchQuery, 
      setSearchQuery, 
      isSearching, 
      getDisplayPhotos 
  } = usePhotoSearch(allPhotos, folderId, folders);

  const {
      isSelectionMode,
      setIsSelectionMode,
      selectedIds,
      setSelectedIds,
      toggleSelectionMode,
      toggleSelect,
      selectAll,
      clearSelection
  } = useSelection();

  // Derived State
  const displayPhotos = getDisplayPhotos(photos);
  
  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [targetPhotoId, setTargetPhotoId] = useState<string | null>(null);

  // Auto-close sidebar on lightbox open (mobile)
  useEffect(() => {
    if (isLightboxOpen) {
      setSidebarOpen(false);
    }
  }, [isLightboxOpen]);
  
  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Actions
  const handleToggleFavorite = async (id: string) => {
    if (!authToken) {
      if (confirm('收藏功能需要登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    // Optimistic update
    const photo = photos.find(p => p.id === id);
    const newIsFavorite = photo ? !photo.isFavorite : true;

    // Update local state
    const updateList = (list: any[]) => list.map(p => p.id === id ? { ...p, isFavorite: newIsFavorite } : p);
    setPhotos(prev => updateList(prev));

    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'toggle_favorite', 
          data: { id } 
        })
      });
    } catch (e) {
      console.error('Failed to toggle favorite', e);
      refresh(); // Revert by refresh
    }
  };

  const handleUpdatePhotoDetail = async (id: string, updates: any) => {
    // Optimistic Update
    const updateList = (list: any[]) => list.map(p => p.id === id ? { ...p, ...updates } : p);
    setPhotos(prev => updateList(prev));

    try {
      const currentPhoto = photos.find(p => p.id === id);
      if (!currentPhoto) return;
      
      const newPhoto = { ...currentPhoto, ...updates };

      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'update_photos', 
          data: newPhoto
        })
      });
    } catch (e) {
      console.error('Failed to update photo details', e);
      refresh();
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'restore_photo', data: { id } })
      });
      refresh();
    } catch (e) {
      alert('恢复失败');
    }
  };

  const handleDeleteForever = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: '温馨提示：此操作将永久删除照片，无法恢复！确定继续吗？',
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_photo_forever', data: { id } })
          });
          refresh();
        } catch (e) {
          alert('永久删除失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: '温馨提示：确定要删除这张照片吗？',
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_photo', data: { id } })
          });
          refresh();
        } catch (e) {
          alert('删除照片失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Batch Actions
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要删除选中的 ${selectedIds.size} 张照片吗？`,
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'batch_delete_photos', 
              data: { ids: Array.from(selectedIds) } 
            })
          });
          refresh();
          clearSelection();
          setIsSelectionMode(false);
        } catch (e) {
          alert('批量删除失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchMove = (targetFolderId: string) => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要将 ${selectedIds.size} 张照片移动到该相册吗？`,
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'batch_move_photos', 
              data: { 
                ids: Array.from(selectedIds), 
                targetFolderId 
              } 
            })
          });
          refresh();
          clearSelection();
          setIsSelectionMode(false);
        } catch (e) {
          alert('批量移动失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const zip = new JSZip();
      const selectedPhotos = photos.filter(p => selectedIds.has(p.id));
      
      const promises = selectedPhotos.map(async (photo) => {
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const filename = photo.url.split('/').pop() || `photo-${photo.id}.jpg`;
          zip.file(filename, blob);
        } catch (err) {
          console.error(`Failed to download ${photo.url}`, err);
        }
      });

      await Promise.all(promises);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm');
      saveAs(content, `photos_${dateStr}.zip`);
      
      clearSelection();
      setIsSelectionMode(false);
    } catch (e) {
      console.error('Batch download failed', e);
      alert('批量下载失败，请重试');
    }
  };

  const handleBatchRestore = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要恢复选中的 ${selectedIds.size} 张照片吗？`,
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedIds).map(id => 
            apiRequest('/data', {
              method: 'POST',
              body: JSON.stringify({ action: 'restore_photo', data: { id } })
            })
          );
          await Promise.all(promises);
          refresh();
          clearSelection();
          setIsSelectionMode(false);
        } catch (e) {
          alert('批量恢复失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDeleteForever = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要永久删除选中的 ${selectedIds.size} 张照片吗？此操作无法撤销！`,
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'batch_delete_photos_forever', 
              data: { ids: Array.from(selectedIds) } 
            })
          });
          refresh();
          clearSelection();
          setIsSelectionMode(false);
        } catch (e) {
          alert('批量永久删除失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        if (isSelectionMode) {
          setIsSelectionMode(false);
          clearSelection();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        if (!isSelectionMode) setIsSelectionMode(true);
        const allIds = displayPhotos.map(p => p.id);
        selectAll(allIds);
      }

      if (e.key.toLowerCase() === 'f') {
        if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          handleToggleFavorite(id);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          handleBatchDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, selectedIds, displayPhotos, handleBatchDelete, handleToggleFavorite]);

  return (
    <div className="h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col transition-colors duration-200 overflow-hidden">
      {/* Easter Eggs */}
      <SearchEasterEgg searchQuery={searchQuery} />

      {/* Top Navigation Bar */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-50 flex-shrink-0 relative">
        <div className="max-w-full px-4 h-14 flex justify-between items-center relative">
          {/* Slogan */}
          <Slogan />

          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </button>
            <Link to="/gallery" className="text-lg font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
              <img src="/confetti.png" alt="Logo" className="w-7 h-7 object-contain" />
              <span className="hidden sm:inline">{siteTitle}</span>
            </Link>
            {/* Album Title Breadcrumb */}
            {folderId && (
               <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-l border-gray-300 dark:border-gray-700 pl-4 ml-2 h-6">
                 <span className="truncate max-w-[150px] sm:max-w-xs" title={folders.find(f => f.id === folderId)?.name}>
                   {folders.find(f => f.id === folderId)?.name}
                 </span>
               </div>
            )}
            {viewMode === 'favorites' && (
               <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-l border-gray-300 dark:border-gray-700 pl-4 ml-2 h-6">
                 <span>我的收藏</span>
               </div>
            )}
            {role === 'admin' && viewMode === 'trash' && (
               <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-l border-gray-300 dark:border-gray-700 pl-4 ml-2 h-6">
                 <span>最近删除</span>
               </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className={`flex items-center transition-all duration-300 mr-1 ${isSearchExpanded ? 'w-40 sm:w-64' : 'w-10'}`}>
               {isSearchExpanded ? (
                  <div className="relative w-full flex items-center">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-full py-1.5 pl-3 pr-8 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors dark:text-white"
                      autoFocus
                      onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                    />
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); setSearchQuery(''); setIsSearchExpanded(false); }}
                      className="absolute right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      {isSearching ? (
                        <div className="animate-spin h-3 w-3 border-b-2 border-blue-500 rounded-full"></div>
                      ) : (
                        <X size={14} />
                      )}
                    </button>
                  </div>
               ) : (
                  <button 
                    onClick={() => setIsSearchExpanded(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors"
                    title="Search"
                  >
                    <Search size={18} />
                  </button>
               )}
            </div>

            {/* Upload Button */}
            {(role === 'admin' || role === 'visitor') && (
              <Link to="/upload" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">
                <UploadIcon size={18} />
                <span className="font-medium">上传</span>
              </Link>
            )}
            
            {(role === 'admin' || role === 'visitor') && (
              <Link to="/upload" className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors">
                <UploadIcon size={18} />
              </Link>
            )}

            {/* User Menu */}
            <div className="relative z-[9999]">
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 overflow-hidden">
                     <User size={20} />
                  </div>
                </button>

                {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setUserMenuOpen(false)}></div>
                      
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999] animate-fade-in-up">
                          {role && (
                            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                   {role === 'admin' ? '管理员' : '访客'}
                                </p>
                            </div>
                          )}

                          <button 
                             onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                             className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                          >
                             {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                             {theme === 'dark' ? '日间模式' : '夜间模式'}
                          </button>

                          {role === 'admin' && (
                             <button 
                               onClick={() => { toggleSelectionMode(); setUserMenuOpen(false); }}
                               className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                             >
                               <CheckSquare size={16} />
                               {isSelectionMode ? '退出多选' : '批量管理'}
                             </button>
                          )}

                          {role === 'admin' && (
                             <Link 
                               to="/settings" 
                               onClick={() => setUserMenuOpen(false)}
                               className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                             >
                               <SettingsIcon size={16} />
                               设置
                             </Link>
                          )}

                          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>

                          {role ? (
                             <button 
                               onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                               className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                             >
                               <LogOut size={16} />
                               退出登录
                             </button>
                          ) : (
                             <Link 
                               to="/login"
                               onClick={() => setUserMenuOpen(false)}
                               className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 transition-colors"
                             >
                               <User size={16} />
                               登录
                             </Link>
                          )}
                      </div>
                    </>
                )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar 
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          isLightboxOpen={isLightboxOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          folderId={folderId}
          favoritesCount={counts?.favorites || 0}
          totalPhotosCount={counts?.total || 0}
          trashCount={counts?.trash || 0}
          role={role}
          folders={folders}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
        />

        {/* Main Content (Photo Grid or Map) */}
        <main className="flex-1 overflow-hidden bg-white dark:bg-black relative" id="scroll-container">
          <div className="h-full">
            {loading && photos.length === 0 ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-center mx-auto max-w-lg mt-10">
                {error}
              </div>
            ) : (
              viewMode === 'map' ? (
                 <MapView photos={allPhotos} />
              ) : (
                 <div className="h-full flex flex-col">
                    {/* Memories (Only in All Photos view) */}
                    {!searchQuery && !folderId && viewMode === 'normal' && (
                       <Memories 
                         photos={photos} 
                         onSelectPhoto={(p) => setTargetPhotoId(p.id)} 
                       />
                    )}
                    
                    <Timeline 
                      photos={displayPhotos} 
                      folders={folders} 
                      onPhotoUpdate={refresh} 
                      isSelectionMode={isSelectionMode}
                      selectedIds={selectedIds}
                      onSelectPhoto={toggleSelect}
                      onDelete={handleDelete}
                      viewMode={viewMode}
                      onRestore={handleRestore}
                      onDeleteForever={handleDeleteForever}
                      onToggleFavorite={handleToggleFavorite}
                      onUpdatePhotoDetail={handleUpdatePhotoDetail}
                      onLightboxChange={setIsLightboxOpen}
                      targetPhotoId={targetPhotoId}
                      onClearTarget={() => setTargetPhotoId(null)}
                      isSearching={!!searchQuery}
                    />
                 </div>
              )
            )}
          </div>
        </main>
      </div>

      {/* Batch Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 flex items-center gap-6 z-50 animate-fade-in-up">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
            已选 {selectedIds.size} 项
          </span>
          
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

          {viewMode === 'trash' ? (
            <>
              <button 
                onClick={handleBatchRestore}
                className="flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              >
                <RotateCcw size={18} />
                <span className="text-sm font-medium hidden sm:inline">恢复</span>
              </button>

              <button 
                onClick={handleBatchDeleteForever}
                className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <Trash2 size={18} />
                <span className="text-sm font-medium hidden sm:inline">永久删除</span>
              </button>
            </>
          ) : (
            <>
              <div className="relative group flex items-center">
                <button className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400">
                  <FolderInput size={18} />
                  <span className="text-sm font-medium hidden sm:inline">移动到</span>
                </button>
                <select 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleBatchMove(e.target.value)}
                  value=""
                >
                  <option value="" disabled>选择相册...</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleBatchDownload}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Download size={18} />
                <span className="text-sm font-medium hidden sm:inline">下载</span>
              </button>

              <button 
                onClick={handleBatchDelete}
                className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <Trash2 size={18} />
                <span className="text-sm font-medium hidden sm:inline">删除</span>
              </button>
            </>
          )}
          
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

          <button onClick={() => { clearSelection(); setIsSelectionMode(false); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400" title="清空选择">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDanger={true}
      />
    </div>
  );
}
