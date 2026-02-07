import ExifReader from 'exifreader';

export const R2_DOMAIN = 'https://im.fivor.de';

export function getPhotoUrl(url: string): string {
  if (!url) return '';
  
  // Replace placeholder domain with actual domain
  if (url.includes('r2.example.com')) {
    return url.replace('https://r2.example.com', R2_DOMAIN);
  }
  
  // If it's a relative path or just a key, prepend domain
  if (!url.startsWith('http')) {
    return `${R2_DOMAIN}/${url.replace(/^\/+/, '')}`;
  }

  return url;
}

export function isHeic(filename: string): boolean {
  return /\.heic$/i.test(filename);
}

// Helper to extract date from EXIF
export const getExifDate = async (file: File): Promise<string | null> => {
  try {
    const tags = await ExifReader.load(file);
    // Try different date tags
    const dateTag = tags['DateTimeOriginal'] || tags['DateTimeDigitized'] || tags['DateTime'];
    
    if (dateTag && dateTag.description) {
      // EXIF date format is usually "YYYY:MM:DD HH:MM:SS"
      const dateParts = dateTag.description.split(' ');
      if (dateParts.length >= 2) {
        const [date, time] = dateParts;
        const [year, month, day] = date.split(':');
        // Return ISO format YYYY-MM-DDTHH:mm:ss
        return `${year}-${month}-${day}T${time}`; 
      }
    }
    return null;
  } catch (e) {
    console.warn('Failed to read EXIF', e);
    return null;
  }
};

// Helper to create a thumbnail blob from an image file
export const createThumbnail = (file: File, maxWidth = 800): Promise<Blob | null> => {
  return new Promise((resolve) => {
    // Skip unsupported types for browser canvas (like HEIC)
    if (!file.type.match(/image\/(jpeg|png|webp)/)) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(img.src);
          resolve(blob);
        }, 'image/webp', 0.95);
      } else {
        URL.revokeObjectURL(img.src);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(null);
    };
  });
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
