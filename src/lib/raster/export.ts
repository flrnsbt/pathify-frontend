/**
 * Raster Export Utility
 * Converts vector SVG or raster results into high-resolution PNG or WebP images
 * entirely in the browser using HTML5 Canvas.
 * Free, client-side, requires zero authentication or credits.
 */

export interface ExportRasterOptions {
  svg?: string | null;
  fallbackDataUrl?: string | null;
  fileName: string;
  format: 'png' | 'webp';
  width?: number;
  height?: number;
  scale?: number; // default 2 for retina / high-resolution clarity
}

export async function exportRasterImage({
  svg,
  fallbackDataUrl,
  fileName,
  format,
  width,
  height,
  scale = 2,
}: ExportRasterOptions): Promise<void> {
  const source = svg
    ? URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    : fallbackDataUrl;

  if (!source) {
    throw new Error('No image source available to export');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const baseWidth = width || img.naturalWidth || 800;
        const baseHeight = height || img.naturalHeight || 800;
        const targetWidth = Math.round(baseWidth * scale);
        const targetHeight = Math.round(baseHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        canvas.toBlob(
          (blob) => {
            if (svg && source.startsWith('blob:')) {
              URL.revokeObjectURL(source);
            }

            if (!blob) {
              reject(new Error(`Failed to encode canvas to ${format.toUpperCase()}`));
              return;
            }

            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const cleanBase = fileName.replace(/\.[^/.]+$/, '');
            link.download = `${cleanBase}-vectorized.${format}`;
            link.href = downloadUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            resolve();
          },
          mimeType,
          0.95
        );
      } catch (err) {
        if (svg && source.startsWith('blob:')) {
          URL.revokeObjectURL(source);
        }
        reject(err);
      }
    };

    img.onerror = () => {
      if (svg && source.startsWith('blob:')) {
        URL.revokeObjectURL(source);
      }
      reject(new Error('Failed to load image for raster export'));
    };

    img.src = source;
  });
}
