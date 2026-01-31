import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useTheme } from '../hooks/useTheme';
import { LogOut, Settings as SettingsIcon, Upload as UploadIcon, Folder as FolderIcon, Sun, Moon, CheckSquare, Trash2, FolderInput, X, Search, ChevronRight, ChevronDown, Menu, Heart, RotateCcw, Clock, Download } from 'lucide-react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { Photo, Folder, Metadata } from '../types';
import Timeline from '../components/Timeline';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Sidebar from '../components/Sidebar';

export default function Gallery() {
  const { logout, role, token: authToken } = useAuth();
  const { t, siteTitle } = useConfig();
  const { theme, toggleTheme } = useTheme();
  const { id: folderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // View Mode derived from location
  const viewMode = useMemo(() => {
    if (location.pathname === '/favorites') return 'favorites';
    if (location.pathname === '/trash') return 'trash';
    return 'normal';
  }, [location.pathname]);

  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Auto-close sidebar on lightbox open (mobile)
  useEffect(() => {
    if (isLightboxOpen) {
      setSidebarOpen(false);
    }
  }, [isLightboxOpen]);
  
  // Data State
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);

  // Pagination State
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Batch Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  useEffect(() => {
    fetchData();
  }, [folderId, location.key, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data: Metadata = await apiRequest('/data');
      
      // Store all photos for counts
      if (data && Array.isArray(data.photos)) {
        setAllPhotos(data.photos);
      }

      let filteredPhotos = [];
      
      if (viewMode === 'trash') {
        // Show deleted photos
        filteredPhotos = data.photos.filter(p => p.deletedAt);
      } else if (viewMode === 'favorites') {
        // Show favorites (and not deleted)
        filteredPhotos = data.photos.filter(p => !p.deletedAt && p.isFavorite);
      } else {
        // Normal view: not deleted
        filteredPhotos = data.photos.filter(p => !p.deletedAt);
        if (folderId) {
          filteredPhotos = filteredPhotos.filter(p => p.folder === folderId);
        }
      }
      
      // Sort folders by pinyin
      const sortedFolders = data.folders.sort((a, b) => 
        a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'accent' })
      );

      setPhotos(filteredPhotos);
      setFolders(sortedFolders);
    } catch (err: any) {
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  // Counts derived from allPhotos
  const totalPhotosCount = useMemo(() => allPhotos.filter(p => !p.deletedAt).length, [allPhotos]);
  const favoritesCount = useMemo(() => allPhotos.filter(p => !p.deletedAt && p.isFavorite).length, [allPhotos]);
  const trashCount = useMemo(() => allPhotos.filter(p => p.deletedAt).length, [allPhotos]);

  // Filtered folders based on search
  const filteredFolders = useMemo(() => {
    if (!searchQuery) return folders;
    return folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [folders, searchQuery]);

  // Paginated photos
  const displayedPhotos = useMemo(() => {
    return photos.slice(0, visibleCount);
  }, [photos, visibleCount]);

  const hasMore = visibleCount < photos.length;

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const handleSelectPhoto = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleFavorite = async (id: string) => {
    // Check if user is logged in
    if (!authToken) {
      // Redirect to login or show modal
      if (confirm('收藏功能需要登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    // Optimistic update first for better UX
    const photo = photos.find(p => p.id === id);
    const newIsFavorite = photo ? !photo.isFavorite : true;

    // Update current view
    setPhotos(prev => prev.map(p => 
      p.id === id ? { ...p, isFavorite: newIsFavorite } : p
    ));
    // Update global store for counts
    setAllPhotos(prev => prev.map(p => 
      p.id === id ? { ...p, isFavorite: newIsFavorite } : p
    ));

    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'update_photos', 
          data: { id, isFavorite: newIsFavorite } 
        })
      });
    } catch (e) {
      console.error('Failed to toggle favorite', e);
      // Revert optimistic update
      setPhotos(prev => prev.map(p => 
        p.id === id ? { ...p, isFavorite: !newIsFavorite } : p
      ));
      // Revert global store
      setAllPhotos(prev => prev.map(p => 
        p.id === id ? { ...p, isFavorite: !newIsFavorite } : p
      ));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'restore_photo', data: { id } })
      });
      await fetchData();
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
          await fetchData();
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
          setLoading(true);
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_photo', data: { id } })
          });
          await fetchData();
        } catch (e) {
          alert('删除照片失败');
          setLoading(false);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要删除选中的 ${selectedIds.size} 张照片吗？`,
      onConfirm: async () => {
        try {
          setLoading(true);
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'batch_delete_photos', 
              data: { ids: Array.from(selectedIds) } 
            })
          });
          await fetchData();
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        } catch (e) {
          alert('批量删除失败');
          setLoading(false);
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
          setLoading(true);
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
          await fetchData();
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        } catch (e) {
          alert('批量移动失败');
          setLoading(false);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    
    setLoading(true);
    try {
      const zip = new JSZip();
      const selectedPhotos = photos.filter(p => selectedIds.has(p.id));
      
      // Fetch all images
      const promises = selectedPhotos.map(async (photo) => {
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          // Use original filename or generate one
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
      
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Batch download failed', e);
      alert('批量下载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchRestore = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要恢复选中的 ${selectedIds.size} 张照片吗？`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const promises = Array.from(selectedIds).map(id => 
            apiRequest('/data', {
              method: 'POST',
              body: JSON.stringify({ action: 'restore_photo', data: { id } })
            })
          );
          await Promise.all(promises);
          await fetchData();
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        } catch (e) {
          alert('批量恢复失败');
          setLoading(false);
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
          setLoading(true);
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'batch_delete_photos_forever', 
              data: { ids: Array.from(selectedIds) } 
            })
          });
          await fetchData();
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        } catch (e) {
          alert('批量永久删除失败');
          setLoading(false);
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
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Esc: Exit selection mode
      if (e.key === 'Escape') {
        if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        }
      }

      // Cmd/Ctrl + A: Select All
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        if (!isSelectionMode) setIsSelectionMode(true);
        // Select all currently displayed photos
        const allIds = new Set(photos.map(p => p.id));
        setSelectedIds(allIds);
      }

      // F: Toggle Favorite (only if 1 item selected)
      if (e.key.toLowerCase() === 'f') {
        if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          handleToggleFavorite(id);
        }
      }

      // Delete/Backspace: Batch Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          handleBatchDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, selectedIds, photos, handleBatchDelete, handleToggleFavorite]);

  return (
    <div className="h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col transition-colors duration-200 overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-20 flex-shrink-0 relative">
        <div className="max-w-full px-4 h-14 flex justify-between items-center">
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
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            {!role && (
              <Link to="/login" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                登录
              </Link>
            )}

            {/* Visitor & Admin Upload Button */}
            {(role === 'admin' || role === 'visitor') && (
              <Link to="/upload" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors">
                <UploadIcon size={18} />
              </Link>
            )}

            {role === 'admin' && (
              <>
                <button
                  onClick={toggleSelectionMode}
                  className={`p-2 rounded-full transition-colors ${isSelectionMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
                  title="批量管理"
                >
                  <CheckSquare size={18} />
                </button>
                
                <Link to="/settings" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors">
                  <SettingsIcon size={18} />
                </Link>
              </>
            )}
            
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 transition-colors">
              <LogOut size={18} />
            </button>
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
          favoritesCount={favoritesCount}
          totalPhotosCount={totalPhotosCount}
          trashCount={trashCount}
          role={role}
          folders={folders}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
        />

        {/* Main Content (Photo Grid) */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-black relative custom-scrollbar scroll-smooth" id="scroll-container">
          <div className="p-2 sm:p-4 md:p-6 pb-24 min-h-full">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-center mx-auto max-w-lg mt-10">
                {error}
              </div>
            ) : (
              <>
                <Timeline 
              photos={displayedPhotos} 
              folders={folders} 
              onPhotoUpdate={fetchData} 
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onSelectPhoto={handleSelectPhoto}
              onDelete={handleDelete}
              viewMode={viewMode}
              onRestore={handleRestore}
              onDeleteForever={handleDeleteForever}
              onToggleFavorite={handleToggleFavorite}
              onLightboxChange={setIsLightboxOpen}
            />
                
                {/* Pagination / Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-8 pb-8">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 50)}
                      className="px-6 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full text-sm font-medium transition-colors"
                    >
                      加载更多
                    </button>
                  </div>
                )}
              </>
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
            // Trash Mode Actions
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
            // Normal Mode Actions
            <>
              <div className="relative group flex items-center">
                <button className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400">
                  <FolderInput size={18} />
                  <span className="text-sm font-medium hidden sm:inline">移动到</span>
                </button>
                {/* Dropdown for folders */}
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

          <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-gray-700 dark:text-gray-400" title="清空选择">
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
