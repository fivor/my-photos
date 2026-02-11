import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, Folder as FolderIcon, ChevronDown, ChevronRight, Trash2, Map } from 'lucide-react';
import { Folder } from '../types';
import { useConfig } from '../context/ConfigContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isLightboxOpen: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'normal' | 'favorites' | 'trash' | 'map';
  folderId?: string;
  favoritesCount: number;
  totalPhotosCount: number;
  trashCount: number;
  role: string | null;
  folders: Folder[];
  expandedFolders: boolean;
  setExpandedFolders: (expanded: boolean) => void;
}

export default function Sidebar({
  isOpen,
  setIsOpen,
  isLightboxOpen,
  searchQuery,
  setSearchQuery,
  viewMode,
  folderId,
  favoritesCount,
  totalPhotosCount,
  trashCount,
  role,
  folders,
  expandedFolders,
  setExpandedFolders,
}: SidebarProps) {
  const { t } = useConfig();

  // Filter and Sort folders
  const filteredFolders = useMemo(() => {
     // Create a shallow copy to avoid mutating props
     const sorted = [...folders];
     sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
     return sorted;
  }, [folders]);

  return (
    <>
      <aside className={`
        absolute inset-y-0 left-0 z-[9999] w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-all duration-300 lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        ${isLightboxOpen ? 'lg:-translate-x-64 lg:w-0 lg:overflow-hidden -translate-x-full' : ''}
      `}>
        <div className="h-full flex flex-col w-64">
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            <div className="text-[10px] text-red-500 font-bold px-3 pb-2 text-center select-none">
                DEBUG: v2026.02.11 (Updated)
            </div>

            <Link 
              to="/favorites"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'favorites' ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <Heart size={16} className={viewMode === 'favorites' ? 'fill-current' : ''} />
              我的收藏
              <span className="ml-auto text-xs opacity-60">{favoritesCount}</span>
            </Link>

            <Link 
              to="/gallery"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'normal' && !folderId ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <FolderIcon size={16} />
              所有照片
              <span className="ml-auto text-xs opacity-60">{totalPhotosCount}</span>
            </Link>

            <Link 
              to="/map"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <Map size={16} />
              地图模式
            </Link>

            <div className="pt-4">
              <button 
                onClick={() => setExpandedFolders(!expandedFolders)}
                className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t('gallery.albums')}
                {expandedFolders ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              {expandedFolders && (
                <div className="mt-1 space-y-0.5">
                  {filteredFolders.map(folder => (
                    <Link
                      key={folder.id}
                      to={`/folder/${folder.id}`}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${folderId === folder.id ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                      <span className="truncate flex-1">{folder.name}</span>
                      <span className="text-xs opacity-60 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{folder.photoCount || 0}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {role === 'admin' && (
              <>
                <div className="my-2 border-t border-gray-200 dark:border-gray-700 mx-2"></div>
                <Link 
                  to="/trash"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'trash' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Trash2 size={16} />
                  最近删除
                  <span className="ml-auto text-xs opacity-60">{trashCount}</span>
                </Link>
              </>
            )}
          </div>
          
          {/* Click outside sidebar to close (for when clicking empty space inside sidebar container if any, though sidebar is full height) */}
        </div>
      </aside>

      {/* Mobile Overlay / Click-Outside Area for Sidebar */}
      {isOpen && (
        <div 
          className="absolute inset-0 bg-black/50 z-[9990] lg:bg-transparent lg:z-[9990]"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
}
