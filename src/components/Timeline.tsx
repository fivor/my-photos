import React from 'react';
import { Photo } from '../types';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { format, parseISO } from 'date-fns';

interface Props {
  photos: Photo[];
}

export default function Timeline({ photos }: Props) {
  // Group photos by date
  const groupedPhotos = photos.reduce((acc, photo) => {
    const date = photo.date ? photo.date : photo.uploadedAt.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedPhotos).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (photos.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>No photos found. Upload some photos to get started!</p>
      </div>
    );
  }

  return (
    <PhotoProvider>
      <div className="space-y-8">
        {sortedDates.map(date => (
          <div key={date} id={`date-${date}`} className="scroll-mt-24">
            <h3 className="text-xl font-semibold text-gray-200 mb-4 sticky top-16 bg-gray-900/90 py-2 backdrop-blur-sm z-10">
              {format(parseISO(date), 'MMMM d, yyyy')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedPhotos[date].map(photo => (
                <PhotoView key={photo.id} src={photo.url}>
                  <div className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer">
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.description || 'Photo'}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {photo.description && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {photo.description}
                      </div>
                    )}
                  </div>
                </PhotoView>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PhotoProvider>
  );
}
