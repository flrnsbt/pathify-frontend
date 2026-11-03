'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Settings2,
  Cpu,
  Crop,
  FileCheck,
} from 'lucide-react';
import {
  VTracerOptions,
  PresetOption,
  PRESET_OPTIONS,
  DEFAULT_VTRACER_OPTIONS,
} from '../lib/vtracer/types';

interface ControlsPanelProps {
  options: VTracerOptions;
  onChange: (newOptions: VTracerOptions) => void;
  onTrace: () => void;
  isProcessing: boolean;
  statusText: string;
  hasImage: boolean;
  autoTrace: boolean;
  onToggleAutoTrace: (enabled: boolean) => void;
  onCropToContent?: () => void;
}

export function ControlsPanel({
  options,
  onChange,
  onTrace,
  isProcessing,
  statusText,
  hasImage,
  autoTrace,
  onToggleAutoTrace,
  onCropToContent,
}: ControlsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setOption = <K extends keyof VTracerOptions>(key: K, value: VTracerOptions[K]) => {
    const updated = { ...options, [key]: value, preset: 'custom' as PresetOption };
    onChange(updated);
  };

  const handleSelectPreset = (preset: PresetOption) => {
    if (preset === 'custom') {
      setOption('preset', 'custom');
      return;
    }
    const presetValues = PRESET_OPTIONS[preset];
    onChange({
      ...options,
      ...presetValues,
      preset,
    });
  };

  const resetDefaults = () => {
    onChange({ ...DEFAULT_VTRACER_OPTIONS });
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-xl backdrop-blur-sm">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-white text-base">Trace Parameters</h2>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          title="Reset to defaults"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Engine Version Selector */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-neutral-300 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            Tracer Engine Version
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
            v2.0.10 Default
          </span>
        </div>
        <select
          value={options.engineVersion || 'vtracer-2.0.10'}
          onChange={(e) =>
            setOption(
              'engineVersion',
              e.target.value as 'vtracer-2.0.10' | 'vtracer-0.2.0'
            )
          }
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
        >
          <option value="vtracer-2.0.10">
            VTracer 2.0.10 (Default: Next-Gen Vector Engine)
          </option>
          <option value="vtracer-0.2.0">
            VTracer 0.2.0 (Classic Legacy Engine)
          </option>
        </select>
      </div>

      {/* Presets Bar */}
      <div>
        <label className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Optimized Presets
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {(['photo', 'gradient', 'pixel-art', 'line-art', 'logo'] as const).map((preset) => {
            const isSelected = options.preset === preset;
            const labels: Record<string, string> = {
              photo: 'Photo',
              gradient: 'Gradient',
              'pixel-art': 'Pixel',
              'line-art': 'Line Art',
              logo: 'Logo',
            };
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`rounded-lg py-1.5 text-xs font-medium capitalize transition border ${isSelected
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'border-neutral-800 bg-neutral-800/40 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800'
                  }`}
              >
                {labels[preset]}
              </button>
            );
          })}
        </div>
      </div>



      {/* SVG Optimization Checkbox */}
      <div className="flex items-center justify-between rounded-xl bg-neutral-950/80 px-3 py-2.5 border border-neutral-800">
        <div>
          <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
            Optimize SVG Output
          </span>
          <p className="text-[11px] text-neutral-500">
            Rounds decimals, merges duplicate paths &amp; reduces SVG size
          </p>
        </div>
        <input
          type="checkbox"
          checked={options.optimizeSvg !== false}
          onChange={(e) => setOption('optimizeSvg', e.target.checked)}
          className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
        />
      </div>

      {/* Crop to Content Feature */}
      <div className="flex flex-col gap-2 rounded-xl bg-neutral-950/80 p-3 border border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
              <Crop className="h-3.5 w-3.5 text-indigo-400" />
              Crop to Content (Auto-Trim)
            </span>
            <p className="text-[11px] text-neutral-500">
              Trims blank transparent or solid background margins
            </p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(options.cropToContent)}
            onChange={(e) => setOption('cropToContent', e.target.checked)}
            className="accent-indigo-500 h-4 w-4 rounded cursor-pointer"
          />
        </div>
        {onCropToContent && hasImage && (
          <button
            type="button"
            onClick={onCropToContent}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 py-1.5 px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition mt-1"
          >
            <Crop className="h-3.5 w-3.5 text-indigo-400" />
            <span>Trim Margins of Loaded Image</span>
          </button>
        )}
      </div>

      {/* Core Mode Toggles */}
      <div className="space-y-4">
        {/* Background Parameter: Solid vs Transparent */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">Background Mode</span>
            <span className="text-neutral-500 capitalize">{options.backgroundMode || 'solid'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOption('backgroundMode', 'solid')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${(options.backgroundMode || 'solid') === 'solid'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              Solid Background
            </button>
            <button
              type="button"
              onClick={() => setOption('backgroundMode', 'transparent')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.backgroundMode === 'transparent'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              Transparent (Cutout)
            </button>
          </div>
        </div>

        {/* Color vs Binary */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">Color Mode</span>
            <span className="text-neutral-500 capitalize">{options.colorMode}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOption('colorMode', 'color')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.colorMode === 'color'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              Full Color
            </button>
            <button
              type="button"
              onClick={() => setOption('colorMode', 'binary')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.colorMode === 'binary'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              Binary (Monochrome / Line)
            </button>
          </div>
        </div>

        {/* Hierarchical: Stacked vs Cutout */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">Layer Hierarchy</span>
            <span className="text-neutral-500 capitalize">{options.hierarchical}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOption('hierarchical', 'stacked')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.hierarchical === 'stacked'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              Stacked (Rich Overlap)
            </button>
            <button
              type="button"
              onClick={() => setOption('hierarchical', 'cutout')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.hierarchical === 'cutout'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              Cutout (Holes / Transparent)
            </button>
          </div>
        </div>

        {/* Path Simplification Mode */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">Curve Fitting Mode</span>
            <span className="text-neutral-500 capitalize">{options.mode}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['spline', 'polygon', 'none'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setOption('mode', m)}
                className={`rounded-lg py-1.5 text-xs font-medium capitalize border transition ${options.mode === m
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                  }`}
              >
                {m === 'spline' ? 'Spline Curves' : m === 'polygon' ? 'Polygons' : 'Raw Edges'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Sliders */}
      <div className="space-y-4 border-t border-neutral-800/80 pt-4">
        {/* Color Palette Richness */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-neutral-300">Palette Richness (Color Count)</span>
            <span className="font-mono text-indigo-400">{options.maxColors || 128} Colors</span>
          </div>
          <input
            type="range"
            min={16}
            max={256}
            step={16}
            value={options.maxColors || 128}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              const prec = Math.min(8, Math.max(4, Math.round(Math.log2(val))));
              const diff = Math.max(2, Math.round(64 / Math.sqrt(val / 16)));
              onChange({
                ...options,
                maxColors: val,
                colorPrecision: prec,
                layerDifference: diff,
                preset: 'custom',
              });
            }}
            className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Higher values keep nuanced color shades and gradients; lower values produce flat shapes.
          </p>
        </div>

        {/* Filter Speckle */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-neutral-300">Filter Speckle (Denoise)</span>
            <span className="font-mono text-indigo-400">{options.filterSpeckle} px</span>
          </div>
          <input
            type="range"
            min={0}
            max={32}
            step={1}
            value={options.filterSpeckle}
            onChange={(e) => setOption('filterSpeckle', parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Removes isolated pixel noise smaller than this area. Set to 0-1 for fine line art.
          </p>
        </div>

        {/* Layer Difference */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-neutral-300">Layer Contour Step</span>
            <span className="font-mono text-indigo-400">{options.layerDifference}</span>
          </div>
          <input
            type="range"
            min={2}
            max={64}
            step={2}
            value={options.layerDifference}
            onChange={(e) => setOption('layerDifference', parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Color distance to separate layers. Lower values (2-6) produce smooth gradient contours.
          </p>
        </div>
      </div>

      {/* Advanced Collapsible Section */}
      <div className="border-t border-neutral-800/80 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between text-xs font-medium text-neutral-400 hover:text-white transition"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Advanced Curve &amp; Path Fine-Tuning
          </span>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-1">
            {/* Color Precision (Bits) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-300">Color Quantization Precision</span>
                <span className="font-mono text-indigo-400">{options.colorPrecision} bits</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={options.colorPrecision}
                onChange={(e) => setOption('colorPrecision', parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Corner Threshold */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-300">Corner Angle Threshold</span>
                <span className="font-mono text-indigo-400">{options.cornerThreshold}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={180}
                step={5}
                value={options.cornerThreshold}
                onChange={(e) => setOption('cornerThreshold', parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Segment Length */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-300">Segment Length Threshold</span>
                <span className="font-mono text-indigo-400">{options.lengthThreshold}</span>
              </div>
              <input
                type="range"
                min={3.5}
                max={10}
                step={0.5}
                value={options.lengthThreshold}
                onChange={(e) => setOption('lengthThreshold', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Max Iterations */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-300">Max Curve Fitting Iterations</span>
                <span className="font-mono text-indigo-400">{options.maxIterations}</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={options.maxIterations}
                onChange={(e) => setOption('maxIterations', parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Path Decimal Precision */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-300">SVG Coordinate Precision</span>
                <span className="font-mono text-indigo-400">{options.pathPrecision} decimals</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={options.pathPrecision}
                onChange={(e) => setOption('pathPrecision', parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Auto-trace toggle & Action Button */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between rounded-lg bg-neutral-800/30 px-3 py-2 border border-neutral-800">
          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Auto-trace on change</span>
          </label>
          <input
            type="checkbox"
            checked={autoTrace}
            onChange={(e) => onToggleAutoTrace(e.target.checked)}
            className="accent-indigo-500 h-4 w-4 rounded cursor-pointer"
          />
        </div>

        <button
          type="button"
          disabled={!hasImage || isProcessing}
          onClick={onTrace}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition shadow-lg ${!hasImage
            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            : isProcessing
              ? 'bg-indigo-700 text-white cursor-wait animate-pulse'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
            }`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{statusText || 'Vectorizing...'}</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Vectorize Image</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
