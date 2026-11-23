'use client';

import type * as Ort from 'onnxruntime-web';

// Loaded from CDN at runtime: the .wasm is ~28 MiB, over Cloudflare Pages'
// 25 MiB per-file limit, so neither it nor the ort bundle ships in `out`.
const ORT_VERSION = '1.31.1';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

type OrtModule = typeof import('onnxruntime-web');

let ortPromise: Promise<OrtModule> | null = null;
function loadOrt(): Promise<OrtModule> {
  ortPromise ??= import(/* webpackIgnore: true */ `${ORT_BASE}ort.all.min.mjs`).then(
    (m) => {
      m.env.wasm.wasmPaths = ORT_BASE;
      return m;
    }
  );
  return ortPromise;
}

export type UpscaleModelId = 'anime' | 'general' | 'general-wdn';

export interface UpscaleModelInfo {
  id: UpscaleModelId;
  label: string;
  description: string;
  url: string;
}

export const UPSCALE_MODELS: UpscaleModelInfo[] = [
  {
    id: 'anime',
    label: 'Anime / Line Art',
    description: 'Real-ESRGAN AnimeVideo v3 — denoise + sharp contours for icons, logos, drawings',
    url: '/models/realesr-animevideov3.onnx',
  },
  {
    id: 'general',
    label: 'Photo / General',
    description: 'Real-ESRGAN General v3 — texture-preserving upscale for photos and complex images',
    url: '/models/realesr-general-x4v3.onnx',
  },
  {
    id: 'general-wdn',
    label: 'Photo / Heavy Denoise',
    description: 'Real-ESRGAN General WDN — strong denoise for compressed/noisy sources',
    url: '/models/realesr-general-wdn-x4v3.onnx',
  },
];

// Tile input size (model outputs 4x). 256 keeps VRAM bounded on WebGPU;
// tiles are processed with a context margin to avoid seam artifacts.
const TILE = 256;
const CONTEXT = 16;
const UPSCALE = 4;

const sessions = new Map<UpscaleModelId, Promise<Ort.InferenceSession>>();
const wasmOnlyModels = new Set<UpscaleModelId>();
let webgpuAvailable: boolean | null = null;

async function detectWebGpu(): Promise<boolean> {
  if (webgpuAvailable !== null) return webgpuAvailable;
  try {
    webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;
  } catch {
    webgpuAvailable = false;
  }
  return webgpuAvailable;
}

async function getSession(model: UpscaleModelInfo): Promise<Ort.InferenceSession> {
  const cached = sessions.get(model.id);
  if (cached) return cached;

  const promise = (async () => {
    const ort = await loadOrt();
    const useWebGpu = (await detectWebGpu()) && !wasmOnlyModels.has(model.id);
    const eps = useWebGpu ? ['webgpu', 'wasm'] : ['wasm'];
    try {
      return await ort.InferenceSession.create(model.url, {
        executionProviders: eps,
        graphOptimizationLevel: 'all',
      });
    } catch (err) {
      if (useWebGpu) {
        console.warn('[Upscale] WebGPU session failed, retrying WASM:', err);
        return await ort.InferenceSession.create(model.url, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      }
      throw err;
    }
  })();

  sessions.set(model.id, promise);
  promise.catch(() => sessions.delete(model.id));
  return promise;
}

function imageDataToCHW(imageData: ImageData, x: number, y: number, w: number, h: number): Float32Array {
  const out = new Float32Array(3 * w * h);
  const data = imageData.data;
  const imgW = imageData.width;
  let p = 0;
  // NCHW planar, RGB in [0,1]
  for (let c = 0; c < 3; c++) {
    for (let j = 0; j < h; j++) {
      const srcRow = ((y + j) * imgW + x) * 4 + c;
      for (let i = 0; i < w; i++) {
        out[p++] = data[srcRow + i * 4] / 255;
      }
    }
  }
  return out;
}

function chwToImageData(
  chw: Float32Array,
  planeW: number,
  planeH: number,
  rx: number,
  ry: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  target: ImageData
): void {
  const data = target.data;
  const tW = target.width;
  const plane = planeW * planeH;
  for (let c = 0; c < 3; c++) {
    const planeBase = c * plane;
    for (let j = 0; j < h; j++) {
      const dstRow = ((dy + j) * tW + dx) * 4;
      const srcRow = (ry + j) * planeW + rx;
      for (let i = 0; i < w; i++) {
        const idx = dstRow + i * 4;
        const v = chw[planeBase + srcRow + i] * 255;
        data[idx + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        data[idx + 3] = 255;
      }
    }
  }
}

async function runTile(
  session: Ort.InferenceSession,
  inputName: string,
  pixels: Float32Array,
  w: number,
  h: number
): Promise<Float32Array> {
  const ort = await loadOrt();
  const tensor = new ort.Tensor('float32', pixels, [1, 3, h, w]);
  const results = await session.run({ [inputName]: tensor });
  const output = results[session.outputNames[0]];
  tensor.dispose();
  for (const name of session.outputNames) {
    if (name !== session.outputNames[0]) results[name]?.dispose?.();
  }
  return (output.data as Float32Array);
}

// Cache of upscaled results per source ImageData + model. The enhancement
// depends only on the input pixels and model — VTracer parameter changes
// reuse the cached result instead of re-running inference.
interface EnhanceCacheEntry {
  promise: Promise<ImageData>;
  listeners: Set<(fraction: number) => void>;
  waiters: number;
  workController: AbortController;
}
const enhanceCache = new WeakMap<ImageData, Map<UpscaleModelId, EnhanceCacheEntry>>();

/**
 * Races a promise against an AbortSignal so callers can stop awaiting early.
 * The shared inference keeps running until its last waiter leaves — see
 * upscaleImageData, which aborts the work itself in that case.
 */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

/**
 * Upscales an ImageData 4x using a Real-ESRGAN ONNX model via onnxruntime-web.
 * Processes the image in overlapping tiles to bound GPU/CPU memory.
 * Results are cached per (source pixels, model) for the session.
 * Pass an AbortSignal to stop awaiting the result. When the last waiter
 * aborts, the inference is cancelled between tiles; a completed result stays
 * cached for subsequent calls.
 */
/** True when an enhanced result is already cached for this source + model. */
export function isEnhancementCached(
  imageData: ImageData,
  modelId: UpscaleModelId
): boolean {
  const model = UPSCALE_MODELS.find((m) => m.id === modelId) ?? UPSCALE_MODELS[0];
  return enhanceCache.get(imageData)?.has(model.id) ?? false;
}

export async function upscaleImageData(
  imageData: ImageData,
  modelId: UpscaleModelId,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<ImageData> {
  const model = UPSCALE_MODELS.find((m) => m.id === modelId) ?? UPSCALE_MODELS[0];

  let perImage = enhanceCache.get(imageData);
  if (!perImage) {
    perImage = new Map();
    enhanceCache.set(imageData, perImage);
  }
  let entry = perImage.get(model.id);
  if (!entry) {
    const listeners = new Set<(fraction: number) => void>();
    const workController = new AbortController();
    const promise = upscaleWithFallback(
      model,
      imageData,
      (f) => {
        listeners.forEach((cb) => {
          try {
            cb(f);
          } catch {
            // ignore listener errors
          }
        });
      },
      workController.signal,
    );
    entry = { promise, listeners, waiters: 0, workController };
    perImage.set(model.id, entry);
    promise.catch(() => perImage!.delete(model.id));
  }

  entry.waiters++;
  if (onProgress) entry.listeners.add(onProgress);
  try {
    return await withAbort(entry.promise, signal);
  } finally {
    entry.waiters--;
    if (onProgress) entry.listeners.delete(onProgress);
    // Last waiter gone (e.g. its trace was superseded) — stop the inference
    // between tiles instead of burning GPU/CPU for an unused result.
    if (entry.waiters === 0) entry.workController.abort();
  }
}

async function upscaleWithFallback(
  model: UpscaleModelInfo,
  imageData: ImageData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<ImageData> {
  try {
    return await upscaleWithSession(model, imageData, onProgress, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    // WebGPU EP can fail at kernel-run time (not session creation) on some
    // model exports — fall back to WASM once and retry the whole image.
    if (!wasmOnlyModels.has(model.id) && (await detectWebGpu())) {
      console.warn('[Upscale] WebGPU inference failed, retrying on WASM:', err);
      wasmOnlyModels.add(model.id);
      sessions.delete(model.id);
      return upscaleWithSession(model, imageData, onProgress, signal);
    }
    throw err;
  }
}

async function upscaleWithSession(
  model: UpscaleModelInfo,
  imageData: ImageData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<ImageData> {
  const session = await getSession(model);
  const inputName = session.inputNames[0];

  const srcW = imageData.width;
  const srcH = imageData.height;
  const outW = srcW * UPSCALE;
  const outH = srcH * UPSCALE;

  const output = new ImageData(outW, outH);

  // Tile grid over the SOURCE image; each inference tile is TILE+2*CONTEXT
  // input pixels (context clipped at borders via clamped sampling).
  const step = TILE;
  let done = 0;
  const total = Math.ceil(srcW / step) * Math.ceil(srcH / step);

  for (let ty = 0; ty < srcH; ty += step) {
    for (let tx = 0; tx < srcW; tx += step) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const x0 = Math.max(0, tx - CONTEXT);
      const y0 = Math.max(0, ty - CONTEXT);
      const x1 = Math.min(srcW, tx + step + CONTEXT);
      const y1 = Math.min(srcH, ty + step + CONTEXT);
      const tw = x1 - x0;
      const th = y1 - y0;

      const input = imageDataToCHW(imageData, x0, y0, tw, th);
      const out = await runTile(session, inputName, input, tw, th);

      // Extract only the requested tile region, cropping the context margin
      const outTW = tw * UPSCALE;
      const outTH = th * UPSCALE;
      const cx0 = (tx - x0) * UPSCALE;
      const cy0 = (ty - y0) * UPSCALE;
      const cw = Math.min(step, srcW - tx) * UPSCALE;
      const ch = Math.min(step, srcH - ty) * UPSCALE;
      chwToImageData(out, outTW, outTH, cx0, cy0, cw, ch, tx * UPSCALE, ty * UPSCALE, output);

      done++;
      onProgress?.(done / total);
    }
  }

  return output;
}
