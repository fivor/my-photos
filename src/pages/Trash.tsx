import React, { useState, useEffect } from 'react';
import { Photo, Metadata } from '../types';
import { apiRequest } from '../utils/api';
import { ArrowLeft, RefreshCw, Trash2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPhotoUrl } from '../utils/image';
import { useConfig } from '../context/ConfigContext';
import ConfirmModal from '../components/ConfirmModal';

export default function Trash() {
  const { t } = useConfig();
  const [deletedPhotos, setDeletedPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const fetchData = async () => {
    try {
      setLoading(true);
      const data: Metadata = await apiRequest('/data');
      setDeletedPhotos(data.photos.filter(p => p.deletedAt).sort((a, b) => 
        new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()
      ));
    } catch (e) {
      console.error('Failed to load photos', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onPhotoUpdate = () => {
    fetchData();
  };

  const handleRestore = async (id: string) => {
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'restore_photo', data: { id } })
      });
      onPhotoUpdate();
    } catch (e) {
      alert(t('trash.failedRestore'));
    }
  };

  const handlePermanentDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: t('trash.confirmDelete'),
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ action: 'permanent_delete_photo', data: { id } })
          });
          onPhotoUpdate();
        } catch (e) {
          alert(t('trash.failedDelete'));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEmptyTrash = () => {
    setConfirmModal({
      isOpen: true,
      message: t('trash.confirmEmpty'),
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ action: 'empty_trash', data: {} })
          });
          onPhotoUpdate();
        } catch (e) {
          alert(t('trash.failedEmpty'));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(Array.from(selectedIds).map(id => 
        apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({ action: 'restore_photo', data: { id } })
        })
      ));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      onPhotoUpdate();
    } catch (e) {
      alert(t('trash.failedRestore'));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      message: t('trash.confirmBatchDelete'),
      onConfirm: async () => {
        try {
          await Promise.all(Array.from(selectedIds).map(id => 
            apiRequest('/data', {
              method: 'POST',
              body: JSON.stringify({ action: 'permanent_delete_photo', data: { id } })
            })
          ));
          setSelectedIds(new Set());
          setIsSelectionMode(false);
          onPhotoUpdate();
        } catch (e) {
          alert(t('trash.failedDelete'));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  if (deletedPhotos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('trash.title')}</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Trash2 className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">{t('trash.emptyState')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 px-4 pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 sticky top-16 z-20 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                {t('trash.title')} <span className="text-sm font-normal text-gray-500">({deletedPhotos.length})</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">{t('trash.itemsDeleted')}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isSelectionMode ? (
              <>
                <button 
                  onClick={handleBatchRestore}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                >
                  <RefreshCw size={16} /> {t('trash.restore')} ({selectedIds.size})
                </button>
                <button 
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 size={16} /> {t('trash.delete')} ({selectedIds.size})
                </button>
                <button 
                  onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
                >
                  {t('trash.cancel')}
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsSelectionMode(true)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
                >
                  {t('trash.select')}
                </button>
                <button 
                  onClick={handleEmptyTrash}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 size={16} /> {t('trash.empty')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {deletedPhotos.map(photo => {
            const daysLeft = 30 - Math.floor((Date.now() - new Date(photo.deletedAt!).getTime()) / (1000 * 60 * 60 * 24));
            const isSelected = selectedIds.has(photo.id);

            return (
              <div 
                key={photo.id} 
                className={`relative group aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-lg transition-all duration-200 ${isSelected ? 'ring-4 ring-blue-500' : ''}`}
                onClick={() => isSelectionMode && toggleSelection(photo.id)}
              >
                <img
                  src={photo.thumbnailUrl ? getPhotoUrl(photo.thumbnailUrl) : getPhotoUrl(photo.url)}
                  alt={photo.description || 'Deleted Photo'}
                  className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                />
                
                <div className="absolute top-2 right-2 flex gap-2">
                   {isSelectionMode ? (
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-black/30 border-white hover:bg-black/50'}`}>
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                   ) : (
                     <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                       {daysLeft} {t('trash.daysLeft')}
                     </div>
                   )}
                </div>

                {!isSelectionMode && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRestore(photo.id); }}
                      className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                      title={t('trash.restore')}
                    >
                      <RefreshCw size={20} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePermanentDelete(photo.id); }}
                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                      title={t('trash.delete')}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
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
