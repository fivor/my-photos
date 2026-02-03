import React, { useMemo } from 'react';
import { Photo } from '../types';
import { format, parseISO, getMonth, getDate, getYear } from 'date-fns';
import { getPhotoUrl } from '../utils/image';
import { Sparkles } from 'lucide-react';

interface Props {
  photos: Photo[];
  onSelectPhoto: (photo: Photo) => void;
}

export default function Memories({ photos, onSelectPhoto }: Props) {
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentDay = getDate(today);
  const currentYear = getYear(today);

  const memories = useMemo(() => {
    return photos.filter(p => {
      const dateStr = p.date || p.uploadedAt;
      const date = parseISO(dateStr);
      // Match Month and Day
      const isSameDay = getMonth(date) === currentMonth && getDate(date) === currentDay;
      // Exclude current year (optional, usually memories are from past)
      const isPast = getYear(date) < currentYear;
      
      return isSameDay && isPast;
    });
  }, [photos, currentMonth, currentDay, currentYear]);

  if (memories.length === 0) return null;

  return (
    <div className="mb-6 px-4">
      <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
        <Sparkles size={20} />
        <h3 className="font-bold text-lg">那年今日</h3>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
        {memories.map(photo => (
          <div 
            key={photo.id} 
            className="flex-shrink-0 w-40 h-56 relative rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all cursor-pointer snap-start group"
            onClick={() => onSelectPhoto(photo)}
          >
            <img 
              src={photo.thumbnailUrl ? getPhotoUrl(photo.thumbnailUrl) : getPhotoUrl(photo.url)} 
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-white font-bold text-lg">{getYear(parseISO(photo.date || photo.uploadedAt))}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
