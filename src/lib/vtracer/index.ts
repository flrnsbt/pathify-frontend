import * as bg from './wasm_vtracer_bg.js';
import {
  VTracerOptions,
  EngineVersionOption,
  DEFAULT_VTRACER_OPTIONS,
} from './types';
import { optimizeSvg } from './optimizer';
import { initVTracer2, isVTracer2Ready, convertImageV2 } from './vtracer2';
import { initVTracer3, isVTracer3Ready, convertImageV3 } from './vtracer3';

/** WASM binary URL for each selectable engine build. */
export const ENGINE_WASM_URLS: Record<EngineVersionOption, string> = {
  'vtracer-2.0.10': '/wasm/vtracer2.wasm',
  'vtracer-1.0.0-alpha.4': '/wasm/vtracer-1.0.0-alpha.4.wasm',
  'vtracer-0.2.0': '/wasm/vtracer.wasm',
};

let wasm1Initialized = false;
let initPromise1: Promise<void> | null = null;

export async function initVTracer(
  wasmBinaryOrUrl?: ArrayBuffer | Uint8Array | string,
  engine: EngineVersionOption = 'vtracer-2.0.10'
): Promise<void> {
  if (engine === 'vtracer-2.0.10') {
    return initVTracer2(wasmBinaryOrUrl || ENGINE_WASM_URLS['vtracer-2.0.10']);
  }

  if (engine === 'vtracer-1.0.0-alpha.4') {
    return initVTracer3(wasmBinaryOrUrl || ENGINE_WASM_URLS['vtracer-1.0.0-alpha.4']);
  }

  // Classic engine (vtracer-0.2.0)
  if (wasm1Initialized && bg.isReady()) {
    return;
  }

  if (initPromise1) {
    return initPromise1;
  }

  initPromise1 = (async () => {
    try {
      let wasmBytes: ArrayBuffer | Uint8Array;

      if (wasmBinaryOrUrl instanceof ArrayBuffer || wasmBinaryOrUrl instanceof Uint8Array) {
        wasmBytes = wasmBinaryOrUrl;
      } else {
        const url = typeof wasmBinaryOrUrl === 'string' ? wasmBinaryOrUrl : '/wasm/vtracer.wasm';
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch VTracer WASM from ${url}: status ${res.status} ${res.statusText}`);
        }
        wasmBytes = await res.arrayBuffer();
      }

      const result = await WebAssembly.instantiate(wasmBytes, {
        './wasm_vtracer_bg.js': bg as unknown as Record<string, WebAssembly.ImportValue>,
      });

      const instance = (result as { instance?: WebAssembly.Instance }).instance || (result as WebAssembly.Instance);
      bg.__wbg_set_wasm(instance.exports);
      bg.init();
      wasm1Initialized = true;
    } catch (err) {
      initPromise1 = null;
      throw err;
    }
  })();

  return initPromise1;
}

export function isVTracerReady(engine: EngineVersionOption = 'vtracer-2.0.10'): boolean {
  if (engine === 'vtracer-2.0.10') {
    return isVTracer2Ready();
  }
  if (engine === 'vtracer-1.0.0-alpha.4') {
    return isVTracer3Ready();
  }
  return wasm1Initialized && bg.isReady();
}

export function countSvgNodes(svg: string): number {
  if (!svg) return 0;
  const pathMatches = svg.match(/<path[\s\S]*?>/gi);
  const polygonMatches = svg.match(/<polygon[\s\S]*?>/gi);
  const circleMatches = svg.match(/<circle[\s\S]*?>/gi);
  const rectMatches = svg.match(/<rect[\s\S]*?>/gi);
  return (
    (pathMatches?.length || 0) +
    (polygonMatches?.length || 0) +
    (circleMatches?.length || 0) +
    (rectMatches?.length || 0)
  );
}

function convertImageV1(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: VTracerOptions
): string {
  const rawBytes = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  const config = new bg.TracerConfig();

  // Color mode
  if (opts.colorMode === 'binary') {
    config.setColorMode(bg.ColorMode.Binary);
  } else {
    config.setColorMode(bg.ColorMode.Color);
  }

  // Hierarchical
  if (opts.hierarchical === 'cutout' || opts.backgroundMode === 'transparent') {
    config.setHierarchical(bg.Hierarchical.Cutout);
  } else {
    config.setHierarchical(bg.Hierarchical.Stacked);
  }

  // Path simplify mode
  if (opts.mode === 'polygon') {
    config.setPathSimplifyMode(bg.PathSimplifyMode.Polygon);
  } else if (opts.mode === 'none') {
    config.setPathSimplifyMode(bg.PathSimplifyMode.None);
  } else {
    config.setPathSimplifyMode(bg.PathSimplifyMode.Spline);
  }

  // Numeric tolerances and thresholds
  if (typeof opts.filterSpeckle === 'number' && opts.filterSpeckle >= 0) {
    config.setFilterSpeckle(opts.filterSpeckle);
  }

  if (typeof opts.colorPrecision === 'number' && opts.colorPrecision >= 1 && opts.colorPrecision <= 8) {
    config.setColorPrecision(opts.colorPrecision);
  }

  if (typeof opts.layerDifference === 'number' && opts.layerDifference >= 0 && opts.layerDifference <= 255) {
    config.setLayerDifference(opts.layerDifference);
  }

  if (typeof opts.cornerThreshold === 'number' && opts.cornerThreshold >= 0 && opts.cornerThreshold <= 180) {
    config.setCornerThreshold(opts.cornerThreshold);
  }

  if (typeof opts.lengthThreshold === 'number' && opts.lengthThreshold >= 3.5 && opts.lengthThreshold <= 10) {
    config.setLengthThreshold(opts.lengthThreshold);
  }

  if (typeof opts.maxIterations === 'number' && opts.maxIterations >= 1) {
    config.setMaxIterations(opts.maxIterations);
  }

  if (typeof opts.spliceThreshold === 'number' && opts.spliceThreshold >= 0 && opts.spliceThreshold <= 180) {
    config.setSpliceThreshold(opts.spliceThreshold);
  }

  if (typeof opts.pathPrecision === 'number' && opts.pathPrecision >= 0 && opts.pathPrecision <= 8) {
    config.setPathPrecision(opts.pathPrecision);
  }

  try {
    return bg.convertImageToSvg(rawBytes, width, height, config);
  } finally {
    if (typeof config.free === 'function') {
      config.free();
    }
  }
}

export function convertImage(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: Partial<VTracerOptions> = {}
): string {
  const opts: VTracerOptions = { ...DEFAULT_VTRACER_OPTIONS, ...options };
  const engine = opts.engineVersion || 'vtracer-2.0.10';

  if (!isVTracerReady(engine)) {
    throw new Error(`VTracer WASM (${engine}) is not initialized. Please call initVTracer(url, '${engine}') first.`);
  }

  let resultSvg: string;
  if (engine === 'vtracer-0.2.0') {
    resultSvg = convertImageV1(pixels, width, height, opts);
  } else if (engine === 'vtracer-1.0.0-alpha.4') {
    resultSvg = convertImageV3(pixels, width, height, opts);
  } else {
    resultSvg = convertImageV2(pixels, width, height, opts);
  }

  // Ensure viewBox is always present for responsive non-clipped scaling
  if (resultSvg && !resultSvg.includes('viewBox')) {
    resultSvg = resultSvg.replace('<svg ', `<svg viewBox="0 0 ${width} ${height}" `);
  }

  // Fix: In binary / silhouette / line-art tracing, VTracer sets fill="none" on paths which
  // causes them to render completely invisible. Replace with solid black fill.
  if (opts.colorMode === 'binary' || opts.preset === 'line-art') {
    resultSvg = resultSvg.replace(/fill="none"/g, 'fill="#000000"');
  } else if (!resultSvg.includes('fill="#') && resultSvg.includes('fill="none"')) {
    resultSvg = resultSvg.replace(/fill="none"/g, 'fill="#000000"');
  }

  // Transparent background processing:
  // When transparent background is requested, strip the outer bounding path
  // that covers the canvas edges (typically the first path in cutout mode).
  if (opts.backgroundMode === 'transparent' && resultSvg) {
    const firstPathMatch = resultSvg.match(/<path[^>]+>/i);
    if (firstPathMatch) {
      const firstPath = firstPathMatch[0];
      // If it starts at (0,0) or reaches width/height corners
      if (
        firstPath.includes('M 0 0') ||
        firstPath.includes('M0 0') ||
        firstPath.includes(`L ${width} 0`) ||
        firstPath.includes(`L${width} 0`) ||
        firstPath.includes(`L ${width} ${height}`) ||
        firstPath.includes(`L${width} ${height}`)
      ) {
        resultSvg = resultSvg.replace(firstPath, '');
      }
    }
  }

  // SVG Optimization: clean decimals, merge paths with matching fills, remove empty tags
  if (opts.optimizeSvg !== false && resultSvg) {
    resultSvg = optimizeSvg(resultSvg, {
      decimalPlaces: 2,
      mergePaths: true,
      cleanWhitespace: true,
      removeEmptyTags: true,
    });
  }

  return resultSvg;
}

/**
 * Converts an SVG string into a high-quality WebP bitmap data URL.
 * Uses 2x-3x supersampling to ensure the preview bitmap is crisp and equivalent
 * in visual sharpness to the bitmap source, while preventing vector geometry theft.
 */
export async function svgToWebpBitmap(
  svg: string,
  width: number,
  height: number,
  quality = 0.98
): Promise<string> {
  if (typeof window === 'undefined' || !svg) return '';
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          const w = Math.max(1, Math.round(width || img.naturalWidth || 400));
          const h = Math.max(1, Math.round(height || img.naturalHeight || 400));
          // Supersample up to 3x (or max dimension 2400) for Retina / 4K sharpness
          const scale = Math.max(2, Math.min(3, Math.round(2400 / Math.max(w, h))));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext('2d', { alpha: true });
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          const webpDataUrl = canvas.toDataURL('image/webp', quality);
          if (webpDataUrl && webpDataUrl.startsWith('data:image')) {
            resolve(webpDataUrl);
          } else {
            resolve(canvas.toDataURL('image/png'));
          }
        } catch (canvasErr) {
          console.warn('Canvas rasterization error:', canvasErr);
          URL.revokeObjectURL(url);
          resolve('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
        }
      };

      img.onerror = (e) => {
        console.warn('SVG preview image load error, falling back to direct SVG data URI:', e);
        URL.revokeObjectURL(url);
        resolve('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
      };

      img.src = url;
    } catch (err) {
      console.warn('svgToWebpBitmap error:', err);
      resolve('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
    }
  });
}

export * from './types';
export * from './autocrop';
export * from './optimizer';
export * from './compression';
export * from './vtracer2';
export * from './vtracer3';
