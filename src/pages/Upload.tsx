import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon, X, Plus, Folder as FolderIcon } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { Folder } from '../types';
import { format } from 'date-fns';

interface UploadFile extends File {
  preview: string;
  description: string;
  date: string;
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error';
}

export default function Upload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const data = await apiRequest('/data');
      setFolders(data.folders);
      if (data.folders.length > 0) {
        setSelectedFolder(data.folders[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file),
      description: '',
      date: format(new Date(file.lastModified), 'yyyy-MM-dd'),
      uploadStatus: 'pending'
    })) as UploadFile[];
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] }
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

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!selectedFolder) {
      alert('Please select a folder');
      return;
    }

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.uploadStatus === 'success') continue;

      try {
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i].uploadStatus = 'uploading';
          return newFiles;
        });

        // 1. Get upload URL
        const { uploadUrl, photoId, publicUrl, key } = await apiRequest('/upload-url', {
          method: 'POST',
          body: JSON.stringify({ 
            filename: file.name,
            folder: selectedFolder
          })
        });

        // 2. Upload file
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file
        });

        // 3. Save metadata
        const photoData = {
          id: photoId,
          filename: key,
          url: publicUrl,
          thumbnailUrl: publicUrl,
          date: file.date,
          description: file.description,
          folder: selectedFolder,
          uploadedAt: new Date().toISOString()
        };

        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({ action: 'update_photos', data: photoData })
        });

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
      }
    }

    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-800 p-4 sticky top-0 bg-gray-900 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/gallery" className="p-2 hover:bg-gray-800 rounded-full">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold">Upload Photos</h1>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon size={18} />
                Start Upload
              </>
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8">
        {/* Left: Dropzone & Settings */}
        <div className="w-full md:w-1/3 space-y-6">
          {/* Folder Selection */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FolderIcon size={18} />
              Target Album
            </h3>
            
            {!showNewFolderInput ? (
              <div className="space-y-3">
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                >
                  <option value="" disabled>Select an album</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Plus size={16} /> Create new album
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Album name"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateFolder}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-md py-1 text-sm"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewFolderInput(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-md py-1 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'}
            `}
          >
            <input {...getInputProps()} />
            <UploadIcon className="mx-auto mb-4 text-gray-400" size={32} />
            <p className="text-gray-400">Drag & drop photos here, or click to select files</p>
          </div>
        </div>

        {/* Right: File List */}
        <div className="flex-1 space-y-4">
          <h3 className="font-semibold text-lg">Selected Photos ({files.length})</h3>
          
          {files.length === 0 && (
            <div className="text-center py-20 text-gray-600 bg-gray-800/30 rounded-lg">
              No photos selected
            </div>
          )}

          <div className="grid gap-4">
            {files.map((file, index) => (
              <div key={file.preview} className="bg-gray-800 p-4 rounded-lg flex gap-4 relative group">
                <img
                  src={file.preview}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-md bg-gray-900"
                />
                
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between">
                     <span className="text-sm text-gray-400 truncate max-w-[200px]">{file.name}</span>
                     {file.uploadStatus === 'success' && <span className="text-green-400 text-sm">Uploaded</span>}
                     {file.uploadStatus === 'error' && <span className="text-red-400 text-sm">Error</span>}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date Taken</label>
                      <input
                        type="date"
                        value={file.date}
                        onChange={(e) => updateFile(index, 'date', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                        disabled={file.uploadStatus === 'success'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <input
                        type="text"
                        value={file.description}
                        onChange={(e) => updateFile(index, 'description', e.target.value)}
                        placeholder="Optional description"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                        disabled={file.uploadStatus === 'success'}
                      />
                    </div>
                  </div>
                </div>

                {file.uploadStatus !== 'success' && (
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-2 right-2 p-1 bg-gray-700 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
