export type ColorModeOption = 'color' | 'binary';
export type HierarchicalOption = 'stacked' | 'cutout';
export type PathSimplifyModeOption = 'polygon' | 'spline' | 'none';
export type PresetOption = 'photo' | 'pixel-art' | 'line-art' | 'logo' | 'custom';

export interface VTracerOptions {
  colorMode: ColorModeOption;
  hierarchical: HierarchicalOption;
  mode: PathSimplifyModeOption;
  filterSpeckle: number; // e.g. 0 - 64
  colorPrecision: number; // 1 - 8
  layerDifference: number; // 0 - 255
  cornerThreshold: number; // 0 - 180
  lengthThreshold: number; // 3.5 - 10
  maxIterations: number; // 1 - 30
  spliceThreshold: number; // 0 - 180
  pathPrecision: number; // 0 - 8
  preset?: PresetOption;
}

export const DEFAULT_VTRACER_OPTIONS: VTracerOptions = {
  colorMode: 'color',
  hierarchical: 'cutout',
  mode: 'spline',
  filterSpeckle: 4,
  colorPrecision: 6,
  layerDifference: 16,
  cornerThreshold: 60,
  lengthThreshold: 4,
  maxIterations: 10,
  spliceThreshold: 45,
  pathPrecision: 2,
  preset: 'photo',
};

export const PRESET_OPTIONS: Record<Exclude<PresetOption, 'custom'>, Partial<VTracerOptions>> = {
  photo: {
    colorMode: 'color',
    hierarchical: 'stacked',
    mode: 'spline',
    filterSpeckle: 4,
    colorPrecision: 6,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 2,
  },
  'pixel-art': {
    colorMode: 'color',
    hierarchical: 'cutout',
    mode: 'polygon',
    filterSpeckle: 0,
    colorPrecision: 8,
    layerDifference: 8,
    cornerThreshold: 180,
    lengthThreshold: 3.5,
    maxIterations: 1,
    spliceThreshold: 180,
    pathPrecision: 1,
  },
  'line-art': {
    colorMode: 'binary',
    hierarchical: 'stacked',
    mode: 'spline',
    filterSpeckle: 2,
    colorPrecision: 2,
    layerDifference: 64,
    cornerThreshold: 45,
    lengthThreshold: 4,
    maxIterations: 15,
    spliceThreshold: 45,
    pathPrecision: 2,
  },
  logo: {
    colorMode: 'color',
    hierarchical: 'cutout',
    mode: 'spline',
    filterSpeckle: 8,
    colorPrecision: 5,
    layerDifference: 24,
    cornerThreshold: 90,
    lengthThreshold: 5,
    maxIterations: 12,
    spliceThreshold: 60,
    pathPrecision: 2,
  },
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
