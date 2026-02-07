import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon, X, Plus, Folder as FolderIcon, Edit2, Check, Trash2, Sun, Moon } from 'lucide-react';
import { apiRequest, API_BASE } from '../utils/api';
import { Folder, Metadata } from '../types';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useTheme } from '../hooks/useTheme';
import ConfirmModal from '../components/ConfirmModal';
import { getExifDate, createThumbnail, formatFileSize } from '../utils/image';

interface UploadResponse {
  uploadUrl: string;
  thumbnailUploadUrl?: string;
  photoId: string;
  publicUrl: string;
  key: string;
  thumbnailKey?: string;
  // New fields
  aiTags?: string[];
  aiDescription?: string;
  blurhash?: string;
  location?: any;
  compressed?: boolean;
  originalSize?: number;
}



interface UploadFile extends File {
  preview: string;
  description: string;
  date: string;
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error';
}

export default function Upload() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useConfig();
  const { theme, toggleTheme } = useTheme();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  
  // New folder state
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  
  // Rename folder state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  useEffect(() => {
    // Try to load cached folders first to speed up rendering
    const cachedFolders = localStorage.getItem('cachedFolders');
    if (cachedFolders) {
        try {
            const parsed = JSON.parse(cachedFolders);
            setFolders(parsed);
            if (parsed.length > 0) {
               setSelectedFolder(parsed[0].id);
            }
        } catch (e) { /* ignore */ }
    }

    if (role) {
      fetchFolders();
    }
  }, [role]);

  const fetchFolders = async () => {
    try {
      // ... existing fetch logic
      const data = await apiRequest<Metadata>('/data');
      
      let finalFolders: Folder[] = [];

      if (role === 'visitor') {
         // ... existing visitor logic
        try {
           const status = await apiRequest<any>('/auth/status');
           const allowed = Array.isArray(status.allowedFolders) ? status.allowedFolders : [];
           localStorage.setItem('allowedFolders', JSON.stringify(allowed));
           finalFolders = data.folders.filter(f => allowed.includes(f.id));
        } catch (authError) {
           const storedAllowedStr = localStorage.getItem('allowedFolders');
           const storedAllowed = storedAllowedStr ? JSON.parse(storedAllowedStr) : [];
           finalFolders = data.folders.filter(f => storedAllowed.includes(f.id));
        }
      } else {
        finalFolders = data.folders;
      }
      
      setFolders(finalFolders);
      
      // Update cache
      localStorage.setItem('cachedFolders', JSON.stringify(finalFolders));
      
      if (finalFolders.length > 0 && (!selectedFolder || !finalFolders.find(f => f.id === selectedFolder))) {
         setSelectedFolder(finalFolders[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(acceptedFiles.map(async (file) => {
      const exifDate = await getExifDate(file);
      const date = exifDate || format(new Date(file.lastModified), "yyyy-MM-dd'T'HH:mm:ss");
      
      return Object.assign(file, {
        preview: URL.createObjectURL(file),
        description: '',
        date: date,
        uploadStatus: 'pending'
      }) as UploadFile;
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tiff', '.tif'],
      'image/avif': ['.avif']
    }
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateFile = (index: number, field: keyof UploadFile, value: string) => {
    setFiles(prev => {
      const newFiles = [...prev];
      // @ts-ignore
      newFiles[index][field] = value;
      return newFiles;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    try {
      const id = crypto.randomUUID();
      const newFolder: Folder = {
        id,
        name: newFolderName,
        createdAt: new Date().toISOString(),
        photoCount: 0
      };
      
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ action: 'add_folder', data: newFolder })
      });
      
      setFolders(prev => [...prev, newFolder]);
      setSelectedFolder(id);
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (e) {
      alert('Failed to create folder');
    }
  };

  const handleRenameFolder = async (id: string) => {
    if (!editFolderName.trim()) return;
    try {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'update_folder', 
          data: { id, name: editFolderName } 
        })
      });
      
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: editFolderName } : f));
      setEditingFolderId(null);
      setEditFolderName('');
    } catch (e) {
      alert('Failed to rename folder');
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    setConfirmModal({
      isOpen: true,
      message: `温馨提示：确定要删除相册 "${folderName}" 及其所有照片吗？此操作无法撤销！`,
      onConfirm: async () => {
        try {
          await apiRequest('/data', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'delete_folder', 
              data: { id: folderId } 
            })
          });
          
          setFolders(prev => prev.filter(f => f.id !== folderId));
          if (selectedFolder === folderId) {
            setSelectedFolder('');
          }
        } catch (e) {
          alert('删除相册失败');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const startRename = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!selectedFolder) {
      alert('Please select a folder');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    let completedCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      if (file.uploadStatus === 'success') {
        completedCount++;
        continue;
      }

      try {
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i].uploadStatus = 'uploading';
          return newFiles;
        });

        const { uploadUrl, thumbnailUploadUrl, photoId, publicUrl, key } = await apiRequest<UploadResponse>('/upload-url', {
          method: 'POST',
          body: JSON.stringify({ 
            filename: file.name,
            folder: selectedFolder
          })
        });

        // 1. Generate thumbnail (Client-side)
        const thumbnailBlob = thumbnailUploadUrl ? await createThumbnail(file) : null;

        // Fix: uploadUrl from backend is a relative path like "/api/upload-file?key=..."
        // In Prod (API_BASE='/api'), full URL should be "/api/upload-file?key=..." (relative to current domain)
        // In Dev (API_BASE='https://api.fivor.de/api'), it should be "https://api.fivor.de/api/upload-file?key=..."
        
        // However, backend returns `/api/upload-file?key=...`. 
        // If we append this to API_BASE (which is `/api`), we get `/api/api/upload-file...`.
        // We need to strip one `/api` if both have it.
        
        let fullUploadUrl = uploadUrl;
        if (!uploadUrl.startsWith('http')) {
           // Remove leading slash to avoid double slash issues when joining
           const relativePath = uploadUrl.startsWith('/') ? uploadUrl.slice(1) : uploadUrl; 
           
           if (API_BASE.startsWith('http')) {
              // Dev Mode: API_BASE is absolute (e.g. https://api.fivor.de/api)
              // If relativePath starts with 'api/', and API_BASE ends with '/api', we might duplicate.
              // But backend returns `/api/upload-file`.
              // So relativePath is `api/upload-file`.
              // API_BASE is `.../api`.
              // Result: `.../api/api/upload-file`.
              
              // We should use the origin of API_BASE + uploadUrl?
              const apiOrigin = new URL(API_BASE).origin;
              fullUploadUrl = `${apiOrigin}/${relativePath}`;
           } else {
              // Prod Mode: API_BASE is '/api'
              // relativePath is 'api/upload-file...'
              // We want just `/api/upload-file...`.
              // So actually, uploadUrl is ALREADY the correct relative path for the root domain if it starts with /api.
              fullUploadUrl = uploadUrl;
           }
        }
        
        // 2. Upload Original
        const uploadOriginalPromise = fetch(fullUploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        // 3. Upload Thumbnail (if generated)
        let uploadThumbnailPromise = Promise.resolve(new Response());
        if (thumbnailBlob && thumbnailUploadUrl) {
           let fullThumbUploadUrl = thumbnailUploadUrl;
           if (!thumbnailUploadUrl.startsWith('http')) {
              const relativePath = thumbnailUploadUrl.startsWith('/') ? thumbnailUploadUrl.slice(1) : thumbnailUploadUrl;
              if (API_BASE.startsWith('http')) {
                 const apiOrigin = new URL(API_BASE).origin;
                 fullThumbUploadUrl = `${apiOrigin}/${relativePath}`;
              } else {
                 fullThumbUploadUrl = thumbnailUploadUrl;
              }
           }
           
           uploadThumbnailPromise = fetch(fullThumbUploadUrl, {
             method: 'PUT',
             body: thumbnailBlob,
             headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'image/webp'
             }
           });
        }

        const [originalRes, thumbRes] = await Promise.all([uploadOriginalPromise, uploadThumbnailPromise]);

        if (!originalRes.ok) {
          const errorText = await originalRes.text().catch(() => '');
          throw new Error(`Upload failed: ${originalRes.status} ${originalRes.statusText} ${errorText}`);
        }
        
        let uploadData: any = {};
        try {
           uploadData = await originalRes.json();
        } catch (e) {
           // Ignore parsing error if response is not JSON
        }

        const thumbSuccess = thumbRes.ok && thumbnailBlob;

        const photoData = {
          id: photoId,
          filename: key,
          url: publicUrl,
          // If we uploaded a thumbnail, save its URL in metadata
          thumbnailUrl: thumbSuccess ? publicUrl.replace(/(\.[^.]+)$/, '-thumb.webp') : undefined,
          date: file.date,
          description: file.description,
          folder: selectedFolder,
          uploadedAt: new Date().toISOString(),
          hasOriginal: uploadData.compressed || false,
          originalSize: uploadData.originalSize,
          // New fields from backend processing
          blurhash: uploadData.blurhash,
          location: uploadData.location,
          aiTags: uploadData.aiTags,
          aiDescription: uploadData.aiDescription
        };

        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({ action: 'update_photos', data: photoData })
        });
        
        // Update local folder photo count immediately
        setFolders(prev => prev.map(f => {
            if (f.id === selectedFolder) {
                return { ...f, photoCount: (f.photoCount || 0) + 1 };
            }
            return f;
        }));

        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i].uploadStatus = 'success';
          return newFiles;
        });

      } catch (e) {
        console.error(e);
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i].uploadStatus = 'error';
          return newFiles;
        });
      } finally {
        completedCount++;
        setUploadProgress(Math.round((completedCount / totalFiles) * 100));
      }
    }

    setUploading(false);
    
    // Show success toast if all succeeded (or finished)
    if (files.every(f => f.uploadStatus === 'success' || f.uploadStatus === 'error')) { // Simplified check
       setShowSuccessToast(true);
       setTimeout(() => {
         setShowSuccessToast(false);
         // Optional: clear successful uploads? User didn't ask for it, but usually good UX.
         // setFiles(prev => prev.filter(f => f.uploadStatus !== 'success'));
       }, 3000);
    }
  };



  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white relative transition-colors duration-200">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down flex items-center gap-2">
          <Check size={20} />
          <span>全部上传完成</span>
        </div>
      )}

      <nav className="border-b border-gray-200 dark:border-gray-800 p-4 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/gallery" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('upload.title')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              title={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

             {uploading && (
               <div className="w-48 hidden md:block">
                 <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                   <span>上传中...</span>
                   <span>{uploadProgress}%</span>
                 </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                   <div 
                     className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                     style={{ width: `${uploadProgress}%` }}
                   ></div>
                 </div>
               </div>
             )}
             
             <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white ${
                files.every(f => f.uploadStatus === 'success') 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  上传中
                </>
              ) : files.length > 0 && files.every(f => f.uploadStatus === 'success') ? (
                <>
                  <Check size={18} />
                  上传完成
                </>
              ) : (
                <>
                  <UploadIcon size={18} />
                  开始上传
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8">
        {/* Left: Album Selector */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FolderIcon size={18} />
              {t('upload.targetAlbum')}
            </h3>
            {role === 'admin' && !showNewFolderInput && (
              <button
                onClick={() => setShowNewFolderInput(true)}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus size={16} /> {t('upload.createAlbum')}
              </button>
            )}
          </div>

          {/* New Folder Input */}
          {showNewFolderInput && (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-500/50 space-y-2 shadow-sm">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('upload.albumName')}
                className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNewFolderInput(false)}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs text-gray-700 dark:text-gray-300"
                >
                  {t('upload.cancel')}
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                >
                  {t('upload.create')}
                </button>
              </div>
            </div>
          )}

          {/* Album List (Grid) */}
          <div className="grid grid-cols-1 gap-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
            {folders.map(f => (
              <div 
                key={f.id}
                onClick={() => setSelectedFolder(f.id)}
                className={`
                  p-3 rounded-lg cursor-pointer border transition-all flex items-center justify-between group shadow-sm
                  ${selectedFolder === f.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500' 
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'}
                `}
              >
                {editingFolderId === f.id ? (
                  <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(f.id);
                        if (e.key === 'Escape') setEditingFolderId(null);
                      }}
                    />
                    <button onClick={() => handleRenameFolder(f.id)} className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingFolderId(null)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <FolderIcon size={18} className={selectedFolder === f.id ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} />
                      <span className={`font-medium truncate ${selectedFolder === f.id ? 'text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>{f.name}</span>
                      {f.photoCount !== undefined && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">({f.photoCount})</span>
                      )}
                    </div>
                    {role === 'admin' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(f); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          title="Rename"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id, f.name); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Upload Zone & Preview */}
        <div className="flex-1 flex flex-col gap-6">
          {/* 1. Drag & Drop Zone (Top) */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.02]' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/80 bg-gray-50 dark:bg-gray-800/30'}
            `}
          >
            <input {...getInputProps()} />
            <UploadIcon className="mx-auto mb-4 text-blue-500 dark:text-blue-400" size={40} />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-1">{t('upload.dragDrop')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">支持 JPG, PNG, WEBP, GIF, AVIF</p>
          </div>

          {/* 2. Selected Photos List (Bottom) */}
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between text-gray-900 dark:text-white">
              <span>{t('upload.selected')} ({files.length})</span>
              {files.length > 0 && (
                <button 
                  onClick={() => setFiles([])} 
                  className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                  disabled={uploading}
                >
                  Clear All
                </button>
              )}
            </h3>
            
            {files.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-600 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-800 border-dashed">
                {t('upload.noSelected')}
              </div>
            ) : (
              <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {files.map((file, index) => (
                  <div key={file.preview} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg flex gap-4 relative group border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="relative w-20 h-20 shrink-0">
                      <img
                        src={file.preview}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-md bg-white dark:bg-gray-900"
                      />
                      {/* Status Overlay */}
                      {file.uploadStatus === 'uploading' && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-md">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-white"></div>
                        </div>
                      )}
                      {file.uploadStatus === 'success' && (
                        <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center rounded-md">
                          <Check size={20} className="text-white" />
                        </div>
                      )}
                      {file.uploadStatus === 'error' && (
                        <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center rounded-md">
                          <X size={20} className="text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex justify-between items-start">
                         <div className="flex flex-col overflow-hidden mr-2">
                           <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={file.name}>{file.name}</span>
                           <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">
                              {file.type.split('/')[1] || 'UNKNOWN'} • {formatFileSize(file.size)}
                           </span>
                         </div>
                         <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                           file.uploadStatus === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' :
                           file.uploadStatus === 'error' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400' :
                           file.uploadStatus === 'uploading' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400' :
                           'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                         }`}>
                           {file.uploadStatus || 'Pending'}
                         </span>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <input
                            type="datetime-local"
                            value={file.date?.substring(0, 16)}
                            onChange={(e) => updateFile(index, 'date', e.target.value + ':00')}
                            className="w-full bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                            disabled={file.uploadStatus === 'success'}
                          />
                        </div>
                        <div className="flex-[2]">
                          <input
                            type="text"
                            value={file.description}
                            onChange={(e) => updateFile(index, 'description', e.target.value)}
                            placeholder="描述（可选）"
                            className="w-full bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                            disabled={file.uploadStatus === 'success'}
                          />
                        </div>
                      </div>
                    </div>

                    {file.uploadStatus !== 'success' && !uploading && (
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 p-1 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full hover:bg-red-500 hover:text-white shadow-md opacity-0 group-hover:opacity-100 transition-all border border-gray-300 dark:border-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
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