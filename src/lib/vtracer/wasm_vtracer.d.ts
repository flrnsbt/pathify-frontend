/* tslint:disable */
/* eslint-disable */

/**
 * Color mode for the tracer
 */
export enum ColorMode {
  /**
   * Full color tracing
   */
  Color = 0,
  /**
   * Binary (black/white) tracing
   */
  Binary = 1,
}

/**
 * Hierarchical clustering mode
 */
export enum Hierarchical {
  /**
   * Stacked layers (shapes can overlap)
   */
  Stacked = 0,
  /**
   * Cutout mode (shapes cut holes in layers below)
   */
  Cutout = 1,
}

/**
 * Path simplification mode
 */
export enum PathSimplifyMode {
  /**
   * Polygon paths (straight lines only)
   */
  Polygon = 0,
  /**
   * Spline curves (smooth Bezier curves)
   */
  Spline = 1,
  /**
   * No simplification (raw pixel edges)
   */
  None = 2,
}

export class TracerConfig {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create a new TracerConfig with default values optimized for pixel art.
   */
  constructor();
  /**
   * Set the color mode (Color = 0, Binary = 1)
   */
  setColorMode(mode: ColorMode): void;
  /**
   * Set the hierarchical mode (Stacked = 0, Cutout = 1)
   */
  setHierarchical(mode: Hierarchical): void;
  /**
   * Set the path simplification mode (Polygon = 0, Spline = 1, None = 2)
   */
  setPathSimplifyMode(mode: PathSimplifyMode): void;
  /**
   * Filter out speckles smaller than this many pixels.
   * Default: 4. Range: 0+
   */
  setFilterSpeckle(val: number): void;
  /**
   * Color precision for quantization (bits per channel).
   * Default: 6. Range: 1-8
   */
  setColorPrecision(val: number): void;
  /**
   * Color difference threshold for layer separation.
   * Default: 16. Range: 0-255
   */
  setLayerDifference(val: number): void;
  /**
   * Corner detection threshold in degrees.
   * Default: 60. Range: 0-180
   */
  setCornerThreshold(val: number): void;
  /**
   * Minimum length for path segments.
   * Default: 4.0. Range: 3.5-10.0
   */
  setLengthThreshold(val: number): void;
  /**
   * Maximum iterations for curve fitting.
   * Default: 10. Range: 1+
   */
  setMaxIterations(val: number): void;
  /**
   * Splice threshold in degrees for curve joining.
   * Default: 45. Range: 0-180
   */
  setSpliceThreshold(val: number): void;
  /**
   * Decimal precision for path coordinates in SVG output.
   * Default: 2. Range: 0-8
   */
  setPathPrecision(val: number): void;
  /**
   * Preset for pixel art: sharp edges, no curve smoothing
   */
  presetPixelArt(): void;
  /**
   * Preset for photos: smooth curves, speckle filtering
   */
  presetPhoto(): void;
  /**
   * Preset for line art: binary mode, high contrast
   */
  presetLineArt(): void;
}

/**
 * Convert RGBA image data to SVG string.
 * 
 * # Arguments
 * * `image_data` - Raw RGBA pixel data (4 bytes per pixel)
 * * `width` - Image width in pixels
 * * `height` - Image height in pixels
 * * `config` - Tracer configuration
 * 
 * # Returns
 * SVG string on success, or error message on failure.
 * 
 * # Example (JavaScript)
 * ```js
 * const config = new TracerConfig();
 * config.presetPixelArt();
 * const svg = convertImageToSvg(imageData, 64, 64, config);
 * ```
 */
export function convertImageToSvg(image_data: Uint8Array, width: number, height: number, config: TracerConfig): string;

/**
 * Convert RGBA image data to SVG with default configuration.
 * 
 * Convenience function using default settings.
 */
export function convertImageToSvgDefault(image_data: Uint8Array, width: number, height: number): string;

/**
 * Convert RGBA image data to SVG optimized for pixel art.
 * 
 * Uses polygon paths (no curves) and preserves sharp edges.
 */
export function convertPixelArtToSvg(image_data: Uint8Array, width: number, height: number): string;

/**
 * Get the library version.
 */
export function getVersion(): string;

/**
 * Initialize the WASM module. Call this once before using other functions.
 * Sets up panic hook for better error messages in browser console.
 */
export function init(): void;

/**
 * Check if the WASM module is ready.
 */
export function isReady(): boolean;
