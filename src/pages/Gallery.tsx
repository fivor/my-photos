import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings as SettingsIcon, Upload as UploadIcon, Folder as FolderIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { Photo, Folder, Metadata } from '../types';
import Timeline from '../components/Timeline';
import CalendarSidebar from '../components/CalendarSidebar';
import { format } from 'date-fns';

export default function Gallery() {
  const { logout, role } = useAuth();
  const { id: folderId } = useParams();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [folderId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data: Metadata = await apiRequest('/data');
      
      let filteredPhotos = data.photos;
      if (folderId) {
        filteredPhotos = data.photos.filter(p => p.folder === folderId);
      }
      
      setPhotos(filteredPhotos);
      setFolders(data.folders);
    } catch (err: any) {
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const scrollToDate = (date: Date) => {
    setCurrentDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const element = document.getElementById(`date-${dateStr}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/gallery" className="text-xl font-bold hover:text-blue-400 transition-colors">
              Photo Gallery
            </Link>
            {folderId && (
              <span className="text-gray-500 text-sm">
                / {folders.find(f => f.id === folderId)?.name || 'Unknown Folder'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <>
                <Link to="/upload" className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors" title="Upload">
                  <UploadIcon size={20} />
                </Link>
                <Link to="/settings" className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors" title="Settings">
                  <SettingsIcon size={20} />
                </Link>
              </>
            )}
            <button onClick={logout} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full flex gap-8 p-4 md:p-8">
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Folder Navigation */}
          {folders.length > 0 && !folderId && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-gray-300">Albums</h2>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {folders.map(folder => (
                  <Link
                    key={folder.id}
                    to={`/folder/${folder.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                  >
                    <FolderIcon size={16} className="text-blue-400" />
                    <span>{folder.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">
                      {folder.photoCount || 0}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 text-red-400 p-4 rounded-lg text-center">
              {error}
            </div>
          ) : (
            <Timeline photos={photos} />
          )}
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <CalendarSidebar 
            photos={photos} 
            currentDate={currentDate}
            onDateClick={scrollToDate}
          />
        </aside>
      </div>
    </div>
  );
}
