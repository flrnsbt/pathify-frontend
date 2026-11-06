export type ColorModeOption = 'color' | 'binary';
export type HierarchicalOption = 'stacked' | 'cutout';
export type PathSimplifyModeOption = 'polygon' | 'spline' | 'none';
export type PresetOption = 'photo' | 'gradient' | 'pixel-art' | 'line-art' | 'logo' | 'custom';
export type EngineVersionOption = 'vtracer-2.0.10' | 'vtracer-1.0.0-alpha.4' | 'vtracer-0.2.0';
export type BackgroundModeOption = 'solid' | 'transparent';

export interface VTracerOptions {
  colorMode: ColorModeOption;
  hierarchical: HierarchicalOption;
  mode: PathSimplifyModeOption;
  filterSpeckle: number; // e.g. 0 - 64
  colorPrecision: number; // 1 - 8 (clustering depth)
  layerDifference: number; // 1 - 255 (lower = finer gradient contours)
  cornerThreshold: number; // 0 - 180
  lengthThreshold: number; // 3.5 - 10
  maxIterations: number; // 1 - 30
  spliceThreshold: number; // 0 - 180
  pathPrecision: number; // 0 - 8
  gradientMode?: boolean; // smooth color transition contours
  maxColors?: number; // target color richness (16 to 256)
  engineVersion?: EngineVersionOption;
  backgroundMode?: BackgroundModeOption; // 'solid' | 'transparent'
  cropToContent?: boolean; // auto-trim margins
  optimizeSvg?: boolean; // clean and optimize paths
  aiEnhance?: boolean; // AI upscale/denoise (Real-ESRGAN) before tracing
  aiEnhanceModel?: 'anime' | 'general' | 'general-wdn';
  preset?: PresetOption;
}

export const DEFAULT_VTRACER_OPTIONS: VTracerOptions = {
  colorMode: 'color',
  hierarchical: 'cutout',
  mode: 'spline',
  filterSpeckle: 2,
  colorPrecision: 7,
  layerDifference: 12,
  cornerThreshold: 60,
  lengthThreshold: 4,
  maxIterations: 10,
  spliceThreshold: 45,
  pathPrecision: 2,
  gradientMode: false,
  maxColors: 128,
  engineVersion: 'vtracer-2.0.10',
  backgroundMode: 'solid',
  cropToContent: false,
  optimizeSvg: true,
  aiEnhance: true,
  aiEnhanceModel: 'general',
  preset: 'photo',
};

export const PRESET_OPTIONS: Record<Exclude<PresetOption, 'custom'>, Partial<VTracerOptions>> = {
  photo: {
    colorMode: 'color',
    hierarchical: 'stacked',
    mode: 'spline',
    filterSpeckle: 2,
    colorPrecision: 7,
    layerDifference: 12,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 2,
    gradientMode: false,
    maxColors: 128,
    aiEnhanceModel: 'general',
  },
  gradient: {
    colorMode: 'color',
    hierarchical: 'stacked',
    mode: 'spline',
    filterSpeckle: 1,
    colorPrecision: 8,
    layerDifference: 4, // Ultra-fine color stepping for smooth gradients
    cornerThreshold: 45,
    lengthThreshold: 3.5,
    maxIterations: 15,
    spliceThreshold: 45,
    pathPrecision: 3,
    gradientMode: true,
    maxColors: 256,
    aiEnhanceModel: 'general',
  },
  'pixel-art': {
    colorMode: 'color',
    hierarchical: 'cutout',
    mode: 'polygon',
    filterSpeckle: 0,
    colorPrecision: 8,
    layerDifference: 4,
    cornerThreshold: 180,
    lengthThreshold: 3.5,
    maxIterations: 1,
    spliceThreshold: 180,
    pathPrecision: 1,
    gradientMode: false,
    aiEnhanceModel: 'anime',
  },
  'line-art': {
    colorMode: 'binary',
    hierarchical: 'cutout',
    mode: 'spline',
    filterSpeckle: 1,
    colorPrecision: 8,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 3.5,
    maxIterations: 12,
    spliceThreshold: 45,
    pathPrecision: 2,
    gradientMode: false,
    aiEnhanceModel: 'anime',
  },
  logo: {
    colorMode: 'color',
    hierarchical: 'cutout',
    mode: 'spline',
    filterSpeckle: 4,
    colorPrecision: 7,
    layerDifference: 16,
    cornerThreshold: 90,
    lengthThreshold: 4.5,
    maxIterations: 12,
    spliceThreshold: 60,
    pathPrecision: 2,
    gradientMode: false,
    aiEnhanceModel: 'anime',
  },
};

export type SampleType = 'logo' | 'pixel' | 'badge';

/**
 * Hand-tuned vectorization parameters attached to each "Try sample" demo
 * image, so a 1-click demo produces the best-looking trace out of the box.
 * These override auto-detection when a sample is loaded — edit the values
 * here to re-tune how each sample vectorizes.
 */
export const SAMPLE_OPTIONS: Record<SampleType, Partial<VTracerOptions>> = {
  // Emblem badge & geometric logo: photo-style rich color tracing
  badge: { ...PRESET_OPTIONS.photo, preset: 'photo' },
  logo: { ...PRESET_OPTIONS.photo, preset: 'photo' },
  // Pixel art: logo-style flat-color tracing
  pixel: { ...PRESET_OPTIONS.logo, preset: 'logo' },
};

export interface WorkerInputPayload {
  id: string;
  pixels: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  options: VTracerOptions;
  wasmUrl?: string;
}

export interface WorkerSuccessResponse {
  id: string;
  success: true;
  svg: string;
  executionTimeMs: number;
  nodeCount: number;
}

export interface WorkerErrorResponse {
  id: string;
  success: false;
  error: string;
  executionTimeMs?: number;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
