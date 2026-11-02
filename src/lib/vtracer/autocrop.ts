/**
 * Auto-crop utility to trim transparent or solid background margins around content.
 */

export interface AutoCropResult {
  imageData: ImageData;
  width: number;
  height: number;
  dataUrl: string;
  cropRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  hasCropped: boolean;
}

export function autoCropImage(
  sourceCanvasOrImage: HTMLCanvasElement | ImageData,
  padding = 8,
  tolerance = 18
): AutoCropResult | null {
  if (typeof window === 'undefined') return null;

  let width: number;
  let height: number;
  let data: Uint8ClampedArray;
  let sourceCanvas: HTMLCanvasElement;

  if (sourceCanvasOrImage instanceof ImageData) {
    width = sourceCanvasOrImage.width;
    height = sourceCanvasOrImage.height;
    data = sourceCanvasOrImage.data;

    sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(sourceCanvasOrImage, 0, 0);
  } else {
    width = sourceCanvasOrImage.width;
    height = sourceCanvasOrImage.height;
    sourceCanvas = sourceCanvasOrImage;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return null;
    data = ctx.getImageData(0, 0, width, height).data;
  }

  if (width <= 0 || height <= 0 || data.length === 0) return null;

  // Determine if image has transparency or solid corner background
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 40) {
    if (data[i] < 200) transparentCount++;
  }

  const isTransparentBackground = transparentCount > (data.length / 40) * 0.02;

  // Sample corner colors
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3],
    };
  };

  const c1 = getPixel(0, 0);
  const c2 = getPixel(width - 1, 0);
  const c3 = getPixel(0, height - 1);
  const c4 = getPixel(width - 1, height - 1);

  // Background color reference from corners
  const bgR = Math.round((c1.r + c2.r + c3.r + c4.r) / 4);
  const bgG = Math.round((c1.g + c2.g + c3.g + c4.g) / 4);
  const bgB = Math.round((c1.b + c2.b + c3.b + c4.b) / 4);

  const isContentPixel = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // If transparent background
    if (isTransparentBackground) {
      return a > 25;
    }

    // Alpha check
    if (a < 50) return false;

    // Color distance from background corner color
    const dist = Math.sqrt(
      (r - bgR) * (r - bgR) +
      (g - bgG) * (g - bgG) +
      (b - bgB) * (b - bgB)
    );

    return dist > tolerance;
  };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // Scan rows
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isContentPixel(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no content found or already tightly cropped
  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  // Apply padding
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

  // If difference is negligible (< 4px on each side), don't crop
  if (
    cropX <= 2 &&
    cropY <= 2 &&
    cropWidth >= width - 4 &&
    cropHeight >= height - 4
  ) {
    return null;
  }

  // Create cropped canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return null;

  croppedCtx.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  const croppedImageData = croppedCtx.getImageData(0, 0, cropWidth, cropHeight);
  const dataUrl = croppedCanvas.toDataURL('image/png');

  return {
    imageData: croppedImageData,
    width: cropWidth,
    height: cropHeight,
    dataUrl,
    cropRect: {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    },
    hasCropped: true,
  };
}
