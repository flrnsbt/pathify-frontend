import { PresetOption } from './types';

export interface DetectedPreset {
  preset: PresetOption;
  confidence: 'high' | 'medium' | 'low';
}

interface ImageStats {
  uniqueColors: number;
  transparentFrac: number;
  edgeFrac: number;
  darkFrac: number;
  lightFrac: number;
  colorfulFrac: number;
  /** Edge pixels / foreground pixels — high for stroke-based art, low for filled shapes. */
  strokeRatio: number;
}

function analyzeImage(imageData: ImageData): ImageStats {
  const { width: w, height: h, data } = imageData;
  const total = w * h;

  // Sample stride to cap work at ~60k pixels
  const stride = Math.max(1, Math.floor(Math.sqrt(total / 60000)));

  const colors = new Set<number>();
  const colorCounts = new Map<number, number>();
  let transparent = 0;
  let sampled = 0;
  let dark = 0;
  let light = 0;
  let colorful = 0;

  // Edge detection on a coarser grid
  const edgeStep = Math.max(1, Math.floor(Math.min(w, h) / 128));
  let edgeCount = 0;
  let edgeTotal = 0;
  let fgCount = 0;
  let fgEdgeCount = 0;

  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      sampled++;
      if (a < 16) {
        transparent++;
        continue;
      }
      // Quantize to 4 bits/channel for palette estimation
      const key =
        ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      colors.add(key);
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 64) dark++;
      else if (lum > 220) light++;
      const cMax = Math.max(data[i], data[i + 1], data[i + 2]);
      const cMin = Math.min(data[i], data[i + 1], data[i + 2]);
      if (cMax - cMin > 30) colorful++;
    }
  }

  // Dominant (background) color — everything else counts as foreground
  let dominantKey = -1;
  let dominantCount = 0;
  for (const [key, count] of colorCounts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantKey = key;
    }
  }

  const quantize = (idx: number) =>
    ((data[idx] >> 4) << 8) | ((data[idx + 1] >> 4) << 4) | (data[idx + 2] >> 4);

  for (let y = 0; y + edgeStep < h; y += edgeStep) {
    for (let x = 0; x + edgeStep < w; x += edgeStep) {
      const i1 = (y * w + x) * 4;
      const i2 = (y * w + x + edgeStep) * 4;
      const lum = (idx: number) =>
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const d = Math.abs(lum(i1) - lum(i2));
      edgeTotal++;
      const isEdge = d > 40;
      if (isEdge) edgeCount++;
      // Foreground = opaque and different from the dominant color
      if (data[i1 + 3] >= 16 && quantize(i1) !== dominantKey) {
        fgCount++;
        if (isEdge) fgEdgeCount++;
      }
    }
  }

  const opaque = Math.max(1, sampled - transparent);
  return {
    uniqueColors: colors.size,
    transparentFrac: transparent / Math.max(1, sampled),
    edgeFrac: edgeTotal > 0 ? edgeCount / edgeTotal : 0,
    darkFrac: dark / opaque,
    lightFrac: light / opaque,
    colorfulFrac: colorful / opaque,
    strokeRatio: fgCount > 0 ? fgEdgeCount / fgCount : 0,
  };
}

/**
 * Whether AI enhancement is likely to meaningfully improve this source.
 * Detailed/noisy raster images benefit; clean flat graphics don't need it.
 */
export function isEnhancementWorthwhile(imageData: ImageData): boolean {
  return analyzeImage(imageData).uniqueColors > 120;
}

/**
 * Heuristically classifies a raster image into the closest vectorization
 * preset. Conservative: ambiguous inputs fall back to 'photo'.
 */
export function detectPreset(imageData: ImageData): DetectedPreset {
  const s = analyzeImage(imageData);
  const isMonochrome = s.colorfulFrac < 0.15;
  // Line art is achromatic AND stroke-dominated: thin marks where most
  // foreground pixels touch an edge. Filled shapes (badges, hearts, icons)
  // have low strokeRatio — they must never reach the binary 'line-art' preset.
  const isLineArt = isMonochrome && s.strokeRatio > 0.2;

  // Transparent-background graphics: logo vs line-art
  if (s.transparentFrac > 0.2) {
    if (isMonochrome && (s.uniqueColors <= 12 || (s.darkFrac + s.lightFrac > 0.85 && s.edgeFrac > 0.2))) {
      return { preset: 'line-art', confidence: 'medium' };
    }
    if (s.uniqueColors <= 64) {
      return { preset: 'logo', confidence: 'medium' };
    }
    return { preset: 'photo', confidence: 'low' };
  }

  // Colorful, few colors, hard edges → pixel art
  if (!isMonochrome && s.uniqueColors <= 48 && s.edgeFrac > 0.12) {
    return { preset: 'pixel-art', confidence: 'medium' };
  }

  // Stroke-dominated monochrome → line art, sketches, receipts, documents
  if (isLineArt && s.uniqueColors <= 128) {
    return { preset: 'line-art', confidence: 'medium' };
  }

  // Few colors → flat graphic (badges, icons, emojis, flat illustrations)
  if (s.uniqueColors <= 48) {
    return { preset: 'logo', confidence: 'medium' };
  }

  // Many colors but very smooth → gradient-heavy image
  if (s.uniqueColors > 300 && s.edgeFrac < 0.06) {
    return { preset: 'gradient', confidence: 'medium' };
  }

  return { preset: 'photo', confidence: 'low' };
}
