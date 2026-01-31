import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

// Lazy load libheif
let libheifPromise: Promise<any> | null = null;
const getLibheif = () => {
  if (!libheifPromise) {
    libheifPromise = import('libheif-js/wasm-bundle')
      .then(m => m.default)
      .then(instance => {
        return instance;
      });
  }
  return libheifPromise;
};

interface HeicImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const HeicImage = ({ src, alt, className }: HeicImageProps) => {
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    const loadHeic = async () => {
      try {
         const proxyUrl = `${API_BASE}/proxy-image?url=${encodeURIComponent(src)}`;
         const res = await fetch(proxyUrl, { mode: 'cors' });
         if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);

         const arrayBuffer = await res.arrayBuffer();

         if (arrayBuffer.byteLength > 0) {
           const header = new Uint8Array(arrayBuffer.slice(0, 12));
           const magic = Array.from(header.slice(0, 4)).map(b => String.fromCharCode(b)).join('');
           
           if (magic === 'RIFF') {
             const blob = new Blob([arrayBuffer], { type: 'image/webp' });
             const url = URL.createObjectURL(blob);
             if (isMounted) {
               setDisplaySrc(url);
               setLoading(false);
             }
             return;
           }

           const ftyp = Array.from(header.slice(4, 8)).map(b => String.fromCharCode(b)).join('');
           if (ftyp !== 'ftyp') {
              const blob = new Blob([arrayBuffer]);
              const url = URL.createObjectURL(blob);
              if (isMounted) {
                setDisplaySrc(url);
                setLoading(false);
              }
              return;
           }
         } else {
           throw new Error('Empty file received');
         }

         const libheif = await getLibheif();
        const decoder = new libheif.HeifDecoder();
        
        const data = decoder.decode(arrayBuffer);
        if (!data || !data.length) throw new Error('No image data found');
        
        const image = data[0];
        const width = image.get_width();
        const height = image.get_height();

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');

        const imageData = ctx.createImageData(width, height);
        
        await new Promise<void>((resolve, reject) => {
          image.display(imageData, (displayData: any) => {
            if (!displayData) {
               return reject(new Error('HEIF display failed'));
            }
            resolve();
          });
        });

        ctx.putImageData(imageData, 0, 0);
        const url = canvas.toDataURL('image/jpeg', 0.7);
        
        if (isMounted) {
          setDisplaySrc(url);
          setLoading(false);
        }
        
      } catch (err: any) {
        if (isMounted) {
          console.debug('HEIC manual decode failed:', err.message);
          setError(true);
          setLoading(false);
        }
      }
    };

    loadHeic();

    return () => {
      isMounted = false;
      if (displaySrc) URL.revokeObjectURL(displaySrc);
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 dark:bg-gray-800 animate-pulse ${className}`}>
        <span className="text-xs text-gray-500">Converting HEIC...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-800 ${className} p-4 text-center`}>
        <div className="font-bold text-gray-500 dark:text-gray-400 border-2 border-gray-400 rounded px-2 py-1 mb-2">
          HEIC
        </div>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
          Preview not supported
        </span>
      </div>
    );
  }

  return <img src={displaySrc} alt={alt} className={className} loading="lazy" />;
};
