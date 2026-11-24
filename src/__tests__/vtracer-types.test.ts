import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VTRACER_OPTIONS,
  PRESET_OPTIONS,
} from '../lib/vtracer/types';

describe('DEFAULT_VTRACER_OPTIONS', () => {
  it('has colorMode = "color"', () => {
    expect(DEFAULT_VTRACER_OPTIONS.colorMode).toBe('color');
  });

  it('has preset = "photo"', () => {
    expect(DEFAULT_VTRACER_OPTIONS.preset).toBe('photo');
  });

  it('has mode = "spline"', () => {
    expect(DEFAULT_VTRACER_OPTIONS.mode).toBe('spline');
  });

  it('has hierarchical = "cutout"', () => {
    expect(DEFAULT_VTRACER_OPTIONS.hierarchical).toBe('cutout');
  });

  it('has filterSpeckle = 2', () => {
    expect(DEFAULT_VTRACER_OPTIONS.filterSpeckle).toBe(2);
  });

  it('has colorPrecision = 7', () => {
    expect(DEFAULT_VTRACER_OPTIONS.colorPrecision).toBe(7);
  });

  it('has cornerThreshold = 60', () => {
    expect(DEFAULT_VTRACER_OPTIONS.cornerThreshold).toBe(60);
  });

  it('has optimizeSvg = true', () => {
    expect(DEFAULT_VTRACER_OPTIONS.optimizeSvg).toBe(true);
  });

  it('has aiEnhance = true', () => {
    expect(DEFAULT_VTRACER_OPTIONS.aiEnhance).toBe(true);
  });
});

describe('PRESET_OPTIONS', () => {
  it('has all 5 non-custom presets', () => {
    const expected = ['photo', 'gradient', 'pixel-art', 'line-art', 'logo'];
    for (const key of expected) {
      expect(PRESET_OPTIONS).toHaveProperty(key);
    }
  });

  it('photo preset has valid fields', () => {
    const photo = PRESET_OPTIONS['photo'];
    expect(photo.colorMode).toBe('color');
    expect(photo.mode).toBe('spline');
    expect(typeof photo.filterSpeckle).toBe('number');
    expect(typeof photo.colorPrecision).toBe('number');
  });

  it('pixel-art preset has mode = "polygon" and cornerThreshold = 180', () => {
    const pixelArt = PRESET_OPTIONS['pixel-art'];
    expect(pixelArt.mode).toBe('polygon');
    expect(pixelArt.cornerThreshold).toBe(180);
  });

  it('line-art preset has colorMode = "binary"', () => {
    expect(PRESET_OPTIONS['line-art'].colorMode).toBe('binary');
  });

  it('gradient preset has gradientMode = true', () => {
    expect(PRESET_OPTIONS['gradient'].gradientMode).toBe(true);
  });

  it('logo preset has filterSpeckle = 4', () => {
    expect(PRESET_OPTIONS['logo'].filterSpeckle).toBe(4);
  });
});
