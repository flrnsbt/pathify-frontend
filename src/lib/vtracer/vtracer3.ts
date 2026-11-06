/**
 * VTracer 1.0.0-alpha.4 WebAssembly Engine Wrapper
 * Upstream visioncortex/vtracer 1.0 alpha — pluggable pipeline framework
 * (color-cluster / bw / watershed frontends, curve fitting, optimization).
 */

import { VTracerOptions, DEFAULT_VTRACER_OPTIONS } from './types';
import {
  initVTracer1Alpha,
  isVTracer1AlphaReady,
  vectorize_rgba,
} from './vtracer_wasm_v1.js';

export { initVTracer1Alpha, isVTracer1AlphaReady };

export async function initVTracer3(wasmBinaryOrUrl?: ArrayBuffer | Uint8Array | string): Promise<void> {
  return initVTracer1Alpha(wasmBinaryOrUrl);
}

export function isVTracer3Ready(): boolean {
  return isVTracer1AlphaReady();
}

interface VTracer1AlphaOptions {
  preset?: 'bw' | 'poster' | 'photo';
  clustering?: 'color-cluster' | 'bw' | 'watershed';
  hierarchical?: 'stacked' | 'cutout';
  mode?: 'pixel' | 'polygon' | 'spline';
  filterSpeckle?: number;
  colorPrecision?: number;
  layerDifference?: number;
  cornerThreshold?: number;
  lengthThreshold?: number;
  maxIterations?: number;
  spliceThreshold?: number;
  simplify?: number;
  pathPrecision?: number;
  maxColors?: number;
  optimize?: number;
  binaryThreshold?: number;
  adaptive?: boolean;
  adaptiveWindow?: number;
  adaptiveT?: number;
  watershedDetail?: number;
}

export function convertImageV3(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: Partial<VTracerOptions> = {}
): string {
  if (!isVTracer3Ready()) {
    throw new Error('VTracer 1.0.0-alpha.4 WASM is not initialized. Please call initVTracer3() first.');
  }

  const opts: VTracerOptions = { ...DEFAULT_VTRACER_OPTIONS, ...options };
  const rawBytes =
    pixels instanceof Uint8Array
      ? pixels
      : new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);

  const isBinary = opts.colorMode === 'binary' || opts.preset === 'line-art';
  const isCutout = opts.hierarchical === 'cutout' || opts.backgroundMode === 'transparent';

  const config: VTracer1AlphaOptions = {
    clustering: isBinary ? 'bw' : opts.preset === 'gradient' ? 'watershed' : 'color-cluster',
    hierarchical: isCutout ? 'cutout' : 'stacked',
    mode: opts.mode === 'polygon' ? 'polygon' : opts.mode === 'none' ? 'pixel' : 'spline',
    filterSpeckle: typeof opts.filterSpeckle === 'number' ? Math.max(0, opts.filterSpeckle) : 4,
    colorPrecision: typeof opts.colorPrecision === 'number' ? Math.min(8, Math.max(1, opts.colorPrecision)) : 6,
    layerDifference: typeof opts.layerDifference === 'number' ? Math.min(255, Math.max(1, opts.layerDifference)) : 16,
    cornerThreshold: typeof opts.cornerThreshold === 'number' ? opts.cornerThreshold : 60,
    lengthThreshold: typeof opts.lengthThreshold === 'number' ? opts.lengthThreshold : 4,
    maxIterations: typeof opts.maxIterations === 'number' ? opts.maxIterations : 10,
    spliceThreshold: typeof opts.spliceThreshold === 'number' ? opts.spliceThreshold : 45,
    simplify: opts.preset === 'line-art' ? 0 : 0.5,
    pathPrecision: typeof opts.pathPrecision === 'number' ? Math.min(8, Math.max(0, opts.pathPrecision)) : 2,
    maxColors: typeof opts.maxColors === 'number' ? opts.maxColors : undefined,
    optimize: 1,
    binaryThreshold: 128,
    adaptive: false,
    adaptiveWindow: 0,
    adaptiveT: 15,
    watershedDetail: 128,
  };

  // Strip undefined so serde never sees explicit nulls
  const clean = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined)
  ) as VTracer1AlphaOptions;

  return vectorize_rgba(rawBytes, width, height, clean);
}
