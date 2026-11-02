/**
 * VTracer 2.0.10 WebAssembly Engine Wrapper
 * Official Visioncortex VTracer 2 engine (Build October 2026)
 * Supports high-fidelity color clustering, adaptive binary line tracing,
 * and high-resolution spline vectorization.
 */

import { VTracerOptions, DEFAULT_VTRACER_OPTIONS } from './types';

interface VTracer2Exports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  __wbindgen_externrefs: WebAssembly.Table;
  __wbindgen_malloc: (size: number, align: number) => number;
  __wbindgen_realloc: (ptr: number, oldSize: number, newSize: number, align: number) => number;
  __wbindgen_free: (ptr: number, size: number, align: number) => void;
  __wbindgen_start: () => void;
  __externref_table_alloc: () => number;
  __externref_table_dealloc: (idx: number) => void;
  __wbindgen_exn_store: (idx: number) => void;
  tracer_new: (w: number, h: number, ptr: number, len: number) => [number, number, number];
  tracer_start: (ptr: number, optPtr: number, optLen: number, cb: number) => [number, number];
  tracer_tick: (ptr: number) => [number, number];
  tracer_done: (ptr: number) => number;
  tracer_svg: (ptr: number) => [number, number];
  __wbg_tracer_free: (ptr: number, flag: number) => void;
}

let wasmExports: VTracer2Exports | null = null;
let wasmInitialized = false;
let initPromise: Promise<void> | null = null;
let cachedUint8Memory: Uint8Array | null = null;

function getUint8Memory(): Uint8Array {
  if (cachedUint8Memory === null || cachedUint8Memory.byteLength === 0) {
    if (!wasmExports) {
      throw new Error('VTracer 2 WASM memory is not available.');
    }
    cachedUint8Memory = new Uint8Array(wasmExports.memory.buffer);
  }
  return cachedUint8Memory;
}

const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
const textEncoder = new TextEncoder();

function decodeString(ptr: number, len: number): string {
  return textDecoder.decode(getUint8Memory().subarray(ptr >>> 0, (ptr >>> 0) + len));
}

function allocateString(str: string): { ptr: number; len: number } {
  if (!wasmExports) {
    throw new Error('VTracer 2 WASM is not loaded.');
  }
  const buf = textEncoder.encode(str);
  const ptr = wasmExports.__wbindgen_malloc(buf.length, 1) >>> 0;
  getUint8Memory().subarray(ptr, ptr + buf.length).set(buf);
  return { ptr, len: buf.length };
}

function allocateBytes(bytes: Uint8Array): { ptr: number; len: number } {
  if (!wasmExports) {
    throw new Error('VTracer 2 WASM is not loaded.');
  }
  const ptr = wasmExports.__wbindgen_malloc(bytes.length, 1) >>> 0;
  getUint8Memory().set(bytes, ptr);
  return { ptr, len: bytes.length };
}

function takeExternRef(idx: number): unknown {
  if (!wasmExports) return null;
  const val = wasmExports.__wbindgen_externrefs.get(idx);
  wasmExports.__externref_table_dealloc(idx);
  return val;
}

function storeExternRef(val: unknown): number {
  if (!wasmExports) return 0;
  const idx = wasmExports.__externref_table_alloc();
  wasmExports.__wbindgen_externrefs.set(idx, val);
  return idx;
}

function safeCall(fn: (...args: unknown[]) => unknown, ...args: unknown[]): unknown {
  try {
    return fn(...args);
  } catch (err) {
    const idx = storeExternRef(err);
    if (wasmExports) {
      wasmExports.__wbindgen_exn_store(idx);
    }
  }
}

export async function initVTracer2(wasmBinaryOrUrl?: ArrayBuffer | Uint8Array | string): Promise<void> {
  if (wasmInitialized && wasmExports) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      let wasmBytes: ArrayBuffer | Uint8Array;

      if (wasmBinaryOrUrl instanceof ArrayBuffer || wasmBinaryOrUrl instanceof Uint8Array) {
        wasmBytes = wasmBinaryOrUrl;
      } else {
        const url = typeof wasmBinaryOrUrl === 'string' ? wasmBinaryOrUrl : '/wasm/vtracer2.wasm';
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch VTracer 2 WASM from ${url}: status ${res.status} ${res.statusText}`);
        }
        wasmBytes = await res.arrayBuffer();
      }

      const imports = {
        './vtracer_webapp_engine_bg.js': {
          __wbg_Error_30c8987f7c2ed4e2: (e: number, t: number) => Error(decodeString(e, t)),
          __wbg___wbindgen_throw_41e9ee4f547fc59a: (e: number, t: number) => {
            throw Error(decodeString(e, t));
          },
          __wbg_call_187d372bd5fdd4aa: (e: (this: unknown, arg: unknown) => unknown, t: unknown, n: unknown) => {
            return safeCall(() => e.call(t, n));
          },
          __wbindgen_generic_0000000000000001: (e: unknown) => e,
          __wbindgen_init_externref_table: () => {
            if (!wasmExports) return;
            const e = wasmExports.__wbindgen_externrefs;
            const t = e.grow(4);
            e.set(0, undefined);
            e.set(t + 0, undefined);
            e.set(t + 1, null);
            e.set(t + 2, true);
            e.set(t + 3, false);
          },
        },
      };

      const result = await WebAssembly.instantiate(wasmBytes, imports);
      const instance = (result as { instance?: WebAssembly.Instance }).instance || (result as WebAssembly.Instance);
      wasmExports = instance.exports as unknown as VTracer2Exports;
      cachedUint8Memory = null;
      wasmExports.__wbindgen_start();
      wasmInitialized = true;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export function isVTracer2Ready(): boolean {
  return wasmInitialized && wasmExports !== null;
}

export interface VTracer2Config {
  clustering: 'color' | 'binary' | 'watershed';
  hierarchical: 'stacked' | 'cutout';
  filterSpeckle: number;
  colorPrecision: number;
  pathPrecision: number;
  layerDifference: number;
  mode: 'spline' | 'polygon' | 'pixel';
  lengthThreshold: number;
  simplify: number;
  optimize: number;
  binaryAdaptive: boolean;
  binaryAdaptiveWindow: number;
  binaryAdaptiveT: number;
  binaryThreshold: number;
  watershedDetail: number;
}

export function convertImageV2(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: Partial<VTracerOptions> = {}
): string {
  if (!isVTracer2Ready() || !wasmExports) {
    throw new Error('VTracer 2 WASM is not initialized. Please call initVTracer2() first.');
  }

  const opts: VTracerOptions = { ...DEFAULT_VTRACER_OPTIONS, ...options };
  const rawBytes = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);

  const { ptr: pPtr, len: pLen } = allocateBytes(rawBytes);
  const createRes = wasmExports.tracer_new(width, height, pPtr, pLen);
  if (createRes[2]) {
    throw takeExternRef(createRes[1]);
  }
  const tracerPtr = createRes[0];

  try {
    // Map VTracerOptions to VTracer 2 configuration
    const isBinary = opts.colorMode === 'binary' || opts.preset === 'line-art';
    const isCutout = opts.hierarchical === 'cutout' || opts.backgroundMode === 'transparent';

    let modeValue: 'spline' | 'polygon' | 'pixel' = 'spline';
    if (opts.mode === 'polygon') {
      modeValue = 'polygon';
    } else if (opts.mode === 'none') {
      modeValue = 'pixel';
    }

    const config: VTracer2Config = {
      clustering: isBinary ? 'binary' : opts.preset === 'gradient' ? 'watershed' : 'color',
      hierarchical: isCutout ? 'cutout' : 'stacked',
      filterSpeckle: typeof opts.filterSpeckle === 'number' ? Math.max(0, opts.filterSpeckle) : 4,
      colorPrecision: typeof opts.colorPrecision === 'number' ? Math.min(8, Math.max(1, opts.colorPrecision)) : 6,
      pathPrecision: typeof opts.pathPrecision === 'number' ? Math.min(8, Math.max(0, opts.pathPrecision)) : 2,
      layerDifference: typeof opts.layerDifference === 'number' ? Math.min(255, Math.max(1, opts.layerDifference)) : 16,
      mode: modeValue,
      lengthThreshold: typeof opts.lengthThreshold === 'number' ? Math.max(1, opts.lengthThreshold) : 4,
      simplify: opts.preset === 'line-art' ? 0 : 0.5,
      optimize: 1,
      binaryAdaptive: false,
      binaryAdaptiveWindow: 64,
      binaryAdaptiveT: 15,
      binaryThreshold: 128,
      watershedDetail: 128,
    };

    const optJson = JSON.stringify(config);
    const { ptr: oPtr, len: oLen } = allocateString(optJson);

    const startRes = wasmExports.tracer_start(tracerPtr, oPtr, oLen, 0);
    if (startRes[1]) {
      throw takeExternRef(startRes[0]);
    }

    // Step through tracer iterations until complete
    while (wasmExports.tracer_done(tracerPtr) === 0) {
      const tickRes = wasmExports.tracer_tick(tracerPtr);
      wasmExports.__wbindgen_free(tickRes[0], tickRes[1], 1);
    }

    const svgRes = wasmExports.tracer_svg(tracerPtr);
    const svgStr = decodeString(svgRes[0], svgRes[1]);
    wasmExports.__wbindgen_free(svgRes[0], svgRes[1], 1);

    return svgStr;
  } finally {
    wasmExports.__wbg_tracer_free(tracerPtr, 0);
  }
}
