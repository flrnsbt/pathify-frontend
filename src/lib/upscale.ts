'use client';

import * as ort from 'onnxruntime-web';

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

const sessions = new Map<UpscaleModelId, Promise<ort.InferenceSession>>();
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

async function getSession(model: UpscaleModelInfo): Promise<ort.InferenceSession> {
  const cached = sessions.get(model.id);
  if (cached) return cached;

  const promise = (async () => {
    const useWebGpu = await detectWebGpu();
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
  session: ort.InferenceSession,
  inputName: string,
  pixels: Float32Array,
  w: number,
  h: number
): Promise<Float32Array> {
  const tensor = new ort.Tensor('float32', pixels, [1, 3, h, w]);
  const results = await session.run({ [inputName]: tensor });
  const output = results[session.outputNames[0]];
  tensor.dispose();
  for (const name of session.outputNames) {
    if (name !== session.outputNames[0]) results[name]?.dispose?.();
  }
  return (output.data as Float32Array);
}

/**
 * Upscales an ImageData 4x using a Real-ESRGAN ONNX model via onnxruntime-web.
 * Processes the image in overlapping tiles to bound GPU/CPU memory.
 */
export async function upscaleImageData(
  imageData: ImageData,
  modelId: UpscaleModelId,
  onProgress?: (fraction: number) => void
): Promise<ImageData> {
  const model = UPSCALE_MODELS.find((m) => m.id === modelId) ?? UPSCALE_MODELS[0];
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
