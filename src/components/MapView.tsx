import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Photo } from '../types';
import L from 'leaflet';
import { getPhotoUrl } from '../utils/image';
import { format, parseISO } from 'date-fns';

// Fix Leaflet Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
  photos: Photo[];
}

// Component to fit bounds
const FitBounds = ({ photos }: { photos: Photo[] }) => {
  const map = useMap();
  
  React.useEffect(() => {
    if (photos.length > 0) {
      const bounds = L.latLngBounds(photos.map(p => [p.location!.lat, p.location!.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [photos, map]);

  return null;
};

export default function MapView({ photos }: Props) {
  const photosWithLocation = useMemo(() => 
    photos.filter(p => p.location?.lat && p.location?.lng), 
  [photos]);

  if (photosWithLocation.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>没有带位置信息的照片</p>
      </div>
    );
  }

  // Group photos by location (simple clustering by exact coordinates)
  // or just render all. For now render all.
  
  // Use OpenStreetMap (Free)
  
  return (
    <div className="h-full w-full relative z-0">
      {/* @ts-ignore */}
      <MapContainer 
        center={[0, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* @ts-ignore */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {photosWithLocation.map(photo => (
          <Marker 
            key={photo.id} 
            position={[photo.location!.lat, photo.location!.lng]}
          >
            {/* @ts-ignore */}
            <Popup className="min-w-[200px]">
              <div className="flex flex-col gap-2">
                <img 
                  src={photo.thumbnailUrl ? getPhotoUrl(photo.thumbnailUrl) : getPhotoUrl(photo.url)} 
                  className="w-full h-32 object-cover rounded" 
                  alt="preview"
                />
                <div className="text-sm">
                  <p className="font-bold">{format(parseISO(photo.date || photo.uploadedAt), 'yyyy-MM-dd')}</p>
                  {photo.location?.name && <p className="text-gray-600">{photo.location.name}</p>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        <FitBounds photos={photosWithLocation} />
      </MapContainer>
    </div>
  );
}
