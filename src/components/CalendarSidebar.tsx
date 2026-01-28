import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Photo } from '../types';

interface Props {
  photos: Photo[];
  currentDate: Date;
  onDateClick: (date: Date) => void;
}

export default function CalendarSidebar({ photos, currentDate, onDateClick }: Props) {
  // Get days with photos
  const daysWithPhotos = photos.reduce((acc, photo) => {
    const date = photo.date ? photo.date : photo.uploadedAt.split('T')[0];
    acc.add(date);
    return acc;
  }, new Set<string>());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="bg-gray-800 rounded-lg p-4 sticky top-24">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
          <div key={d} className="text-gray-500 py-1">{d}</div>
        ))}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasPhotos = daysWithPhotos.has(dateStr);
          const isSelected = isSameDay(day, currentDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => hasPhotos && onDateClick(day)}
              disabled={!hasPhotos}
              className={`
                aspect-square flex items-center justify-center rounded-full transition-colors text-xs
                ${hasPhotos ? 'hover:bg-blue-600/50 cursor-pointer text-white' : 'text-gray-600 cursor-default'}
                ${isSelected ? 'bg-blue-600 text-white font-bold' : ''}
                ${hasPhotos && !isSelected ? 'bg-gray-700' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
