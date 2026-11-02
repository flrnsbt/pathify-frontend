/**
 * Utility functions for image hashing, original image base64 compression,
 * and SVG gzip compression for compact, efficient history storage.
 */

/**
 * Computes a unique, deterministic SHA-256 hash for an image
 * based on its raw pixel bytes.
 */
export async function computeImageHash(
  data: ImageData | ArrayBuffer | Uint8Array | Uint8ClampedArray
): Promise<string> {
  try {
    let bytes: Uint8Array;
    if ('data' in data && data.data instanceof Uint8ClampedArray) {
      bytes = new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.byteLength);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else {
      return `img-${Date.now()}`;
    }

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }

    // Fallback simple hash if subtle crypto is not available
    let hash = 0;
    for (let i = 0; i < bytes.length; i += 16) {
      hash = (hash << 5) - hash + bytes[i];
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16)}`;
  } catch (err) {
    console.warn('computeImageHash error, using fallback:', err);
    return `img-${Date.now()}`;
  }
}

/**
 * Compresses an image to a compact base64 data URL (WebP/JPEG)
 * with max bounding dimension to ensure it easily fits within Firestore and localStorage limits.
 */
export async function compressImageToBase64(
  imageData: ImageData,
  maxDimension = 1024,
  quality = 0.8
): Promise<string> {
  if (typeof document === 'undefined') return '';
  try {
    let { width, height } = imageData;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw scaled image using offscreen temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, width, height);
    }

    // Try WebP compression first (best ratio)
    try {
      const webpUrl = canvas.toDataURL('image/webp', quality);
      if (webpUrl && webpUrl.startsWith('data:image/webp')) {
        return webpUrl;
      }
    } catch {}

    // Fallback to JPEG
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('compressImageToBase64 error:', err);
    return '';
  }
}

/**
 * Compresses an SVG string using native browser gzip CompressionStream.
 * Returns a base64 encoded string prefixed with 'gz:'.
 */
export async function compressSvgString(svg: string): Promise<string> {
  if (!svg) return '';
  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([svg], { type: 'text/plain' })
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const compressedBuffer = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(compressedBuffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return 'gz:' + btoa(binary);
    }
  } catch (err) {
    console.warn('SVG gzip compression failed, falling back to raw SVG:', err);
  }
  return svg;
}

/**
 * Decompresses an SVG string compressed with compressSvgString.
 * Automatically detects whether the string is gzip-compressed ('gz:') or raw SVG.
 */
export async function decompressSvgString(compressed: string): Promise<string> {
  if (!compressed) return '';
  if (!compressed.startsWith('gz:')) {
    // Uncompressed legacy SVG
    return compressed;
  }

  try {
    if (typeof DecompressionStream !== 'undefined') {
      const base64 = compressed.slice(3);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
  } catch (err) {
    console.warn('SVG gzip decompression failed:', err);
  }
  return compressed;
}
