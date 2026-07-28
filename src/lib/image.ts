export interface CompressOptions {
  quality?: number;
  maxWidth?: number;
  format?: 'image/jpeg' | 'image/webp';
}

/**
 * Bulletproof HD Image Compression Engine.
 * Optimized for high-resolution document processing.
 * Constraints image to optimized WebP format for maximum efficiency and quality.
 * No file size limitations; resizing and compression handled via HTML5 Canvas.
 */
export function compressImageToBase64(
  file: File, 
  options: CompressOptions = {}
): Promise<string> {
  const {
    quality = 0.35,
    maxWidth = 650,
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result;
      if (!result) return reject(new Error("Could not read file data."));
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Apply width constraint while maintaining aspect ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Could not create canvas context."));

        // Use high-quality interpolation for document clarity
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          // Convert to optimized Base64
          const base64 = canvas.toDataURL(format, quality);
          
          // Force clear canvas memory
          canvas.width = 0;
          canvas.height = 0;
          
          resolve(base64);
        } catch (e) {
          reject(new Error("Image encoding failed."));
        }
      };

      img.onerror = () => reject(new Error("Could not load image into processing engine."));
      img.src = result as string;
    };

    reader.onerror = () => reject(new Error("FileReader failed to process the document."));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a dataUrl (from camera capture) to same optimized format as gallery images.
 * Works on base64 dataUrl strings directly without needing a File object.
 */
export function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string> {
  const {
    quality = 0.35,
    maxWidth = 650,
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context error.'));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const compressed = canvas.toDataURL(format, quality);
        canvas.width = 0;
        canvas.height = 0;
        resolve(compressed);
      } catch (e) {
        reject(new Error('Image compression failed.'));
      }
    };
    img.onerror = () => reject(new Error('Could not load image for compression.'));
    img.src = dataUrl;
  });
}

/** 
 * Converts a file or blob to a raw data URI string.
 * Used for immediate previews before compression if needed.
 */
export function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Data URI conversion failed.'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
