import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Edit2, Check } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { Photo } from '../types';

interface PhotoDetailsOverlayProps {
  index: number;
  photos: Photo[];
  role: string | null;
  onUpdate?: () => void;
  // react-photo-view passes other props we might ignore or pass through
  [key: string]: any;
}

export const PhotoDetailsOverlay = ({ index, photos, role, onUpdate }: PhotoDetailsOverlayProps) => {
  const photoData = photos[index];
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  
  // Sync state when photo changes
  useEffect(() => {
    if (photoData) {
      setEditDate(photoData.date || (photoData.uploadedAt ? photoData.uploadedAt.split('T')[0] : ''));
      setEditDesc(photoData.description || '');
      setIsEditing(false);
    }
  }, [photoData]);

  if (!photoData) return null;

  const handleSave = async (e: React.FormEvent) => {
     e.stopPropagation(); // Prevent closing lightbox
     e.preventDefault();
     try {
       await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update_photos',
            data: {
               id: photoData.id,
               date: editDate,
               description: editDesc
            }
          })
       });
       setIsEditing(false);
       if (onUpdate) onUpdate();
     } catch (e) {
       alert('保存失败');
     }
  };

  if (isEditing) {
    return (
      <div 
        className="absolute bottom-0 left-0 right-0 p-6 bg-black/60 backdrop-blur-md text-white z-[1000] pointer-events-auto flex justify-center" 
        onClick={e => { e.stopPropagation(); e.preventDefault(); }}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
         <div className="w-full max-w-xl space-y-4">
            <div className="flex gap-2">
              <input 
                type="date" 
                value={editDate} 
                onChange={e => setEditDate(e.target.value)}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-base focus:outline-none focus:border-blue-500"
              />
            </div>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              placeholder="Description..."
              className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white text-base focus:outline-none focus:border-blue-500 resize-none h-24"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsEditing(false); }} 
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 text-sm font-medium flex items-center gap-2"
              >
                <Check size={16} /> Save
              </button>
            </div>
         </div>
      </div>
    );
  }

  // Display mode - Single line layout
  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/50 backdrop-blur-sm text-white pointer-events-auto z-[1000] flex justify-center">
       <div className="w-full max-w-xl flex flex-row items-center justify-between">
          <div className="flex-1 flex flex-row items-center gap-3 min-w-0 overflow-hidden">
            <div className="text-base font-medium text-gray-200 whitespace-nowrap shrink-0">
              {photoData.date || (photoData.uploadedAt ? format(parseISO(photoData.uploadedAt), 'yyyy-MM-dd') : '')}
            </div>
            {photoData.description && (
               <>
                 <div className="w-px h-3 bg-gray-400 shrink-0"></div>
                 <div className="text-base font-normal text-white truncate min-w-0">
                   {photoData.description}
                 </div>
               </>
            )}
          </div>
          
          {role === 'admin' && (
            <button 
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsEditing(true); }}
              onMouseDown={e => e.stopPropagation()}
              onMouseUp={e => e.stopPropagation()}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm ml-4 shrink-0"
              title="Edit Details"
            >
              <Edit2 size={18} />
            </button>
          )}
       </div>
    </div>
  );
};
