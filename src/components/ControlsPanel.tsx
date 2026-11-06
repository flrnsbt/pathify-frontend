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
  EngineVersionOption,
  PRESET_OPTIONS,
  DEFAULT_VTRACER_OPTIONS,
} from '../lib/vtracer/types';
import { useI18n } from '../lib/i18n';

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
  generationsRemaining?: number;
  generationsMax?: number;
  locked?: boolean;
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
  generationsRemaining,
  generationsMax,
  locked = false,
}: ControlsPanelProps) {
  const { t } = useI18n();
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
    <div className={`flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-xl backdrop-blur-sm ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-white text-base">{t('controls.title')}</h2>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          title={t('controls.resetTitle')}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('controls.reset')}</span>
        </button>
      </div>

      {locked && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          {t('controls.lockedNotice')}
        </div>
      )}

      {/* Engine Version Selector */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-neutral-300 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            {t('controls.engineVersion')}
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
            {t('controls.engineBadge')}
          </span>
        </div>
        <select
          value={options.engineVersion || 'vtracer-2.0.10'}
          onChange={(e) =>
            setOption(
              'engineVersion',
              e.target.value as EngineVersionOption
            )
          }
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
        >
          <option value="vtracer-2.0.10">
            {t('controls.engineV2')}
          </option>
          <option value="vtracer-1.0.0-alpha.4">
            {t('controls.engineV3')}
          </option>
          <option value="vtracer-0.2.0">
            {t('controls.engineV1')}
          </option>
        </select>
      </div>

      {/* Presets Bar */}
      <div>
        <label className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          {t('controls.presets')}
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {(['photo', 'gradient', 'pixel-art', 'line-art', 'logo'] as const).map((preset) => {
            const isSelected = options.preset === preset;
            const presetKeys = {
              photo: 'controls.presetPhoto',
              gradient: 'controls.presetGradient',
              'pixel-art': 'controls.presetPixel',
              'line-art': 'controls.presetLineArt',
              logo: 'controls.presetLogo',
            } as const;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`rounded-lg py-1.5 text-xs font-medium border transition ${isSelected
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'border-neutral-800 bg-neutral-800/40 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800'
                  }`}
              >
                {t(presetKeys[preset])}
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
            {t('controls.optimizeSvg')}
          </span>
          <p className="text-[11px] text-neutral-500">
            {t('controls.optimizeSvgDesc')}
          </p>
        </div>
        <input
          type="checkbox"
          checked={options.optimizeSvg !== false}
          onChange={(e) => setOption('optimizeSvg', e.target.checked)}
          className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
        />
      </div>

      {/* AI Enhance (Real-ESRGAN pre-processing) */}
      <div className="flex flex-col gap-2 rounded-xl bg-neutral-950/80 p-3 border border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              {t('controls.aiEnhance')}
            </span>
            <p className="text-[11px] text-neutral-500">
              {t('controls.aiEnhanceDesc')}
            </p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(options.aiEnhance)}
            onChange={(e) => setOption('aiEnhance', e.target.checked)}
            className="accent-violet-500 h-4 w-4 rounded cursor-pointer"
          />
        </div>
        {options.aiEnhance && (
          <div className="grid grid-cols-3 gap-1.5">
            {([
              ['anime', t('controls.modelAnime')],
              ['general', t('controls.modelGeneral')],
              ['general-wdn', t('controls.modelGeneralWdn')],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOption('aiEnhanceModel', id)}
                className={`rounded-lg py-1.5 px-1 text-[11px] font-medium border transition truncate ${
                  (options.aiEnhanceModel || 'anime') === id
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Crop to Content Feature */}
      <div className="flex flex-col gap-2 rounded-xl bg-neutral-950/80 p-3 border border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
              <Crop className="h-3.5 w-3.5 text-indigo-400" />
              {t('controls.cropToContent')}
            </span>
            <p className="text-[11px] text-neutral-500">
              {t('controls.cropDesc')}
            </p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(options.cropToContent)}
            onChange={(e) => setOption('cropToContent', e.target.checked)}
            className="accent-indigo-500 h-4 w-4 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Core Mode Toggles */}
      <div className="space-y-4">
        {/* Background Parameter: Solid vs Transparent */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">{t('controls.backgroundMode')}</span>
            <span className="text-neutral-500">{options.backgroundMode === 'transparent' ? t('controls.bgTransparentValue') : t('controls.bgSolidValue')}</span>
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
              {t('controls.bgSolid')}
            </button>
            <button
              type="button"
              onClick={() => setOption('backgroundMode', 'transparent')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.backgroundMode === 'transparent'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              {t('controls.bgTransparent')}
            </button>
          </div>
        </div>

        {/* Color vs Binary */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">{t('controls.colorMode')}</span>
            <span className="text-neutral-500">{options.colorMode === 'binary' ? t('controls.colorBinary') : t('controls.colorFull')}</span>
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
              {t('controls.colorFull')}
            </button>
            <button
              type="button"
              onClick={() => setOption('colorMode', 'binary')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.colorMode === 'binary'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              {t('controls.colorBinary')}
            </button>
          </div>
        </div>

        {/* Hierarchical: Stacked vs Cutout */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">{t('controls.layerHierarchy')}</span>
            <span className="text-neutral-500">{options.hierarchical === 'cutout' ? t('controls.hierCutout') : t('controls.hierStacked')}</span>
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
              {t('controls.hierStacked')}
            </button>
            <button
              type="button"
              onClick={() => setOption('hierarchical', 'cutout')}
              className={`rounded-lg py-1.5 text-xs font-medium border transition ${options.hierarchical === 'cutout'
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                }`}
            >
              {t('controls.hierCutout')}
            </button>
          </div>
        </div>

        {/* Path Simplification Mode */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-neutral-300">{t('controls.curveMode')}</span>
            <span className="text-neutral-500">{options.mode === 'spline' ? t('controls.modeSpline') : options.mode === 'polygon' ? t('controls.modePolygon') : t('controls.modeRaw')}</span>
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
                {m === 'spline' ? t('controls.modeSpline') : m === 'polygon' ? t('controls.modePolygon') : t('controls.modeRaw')}
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
            <span className="font-medium text-neutral-300">{t('controls.paletteRichness')}</span>
            <span className="font-mono text-indigo-400">{t('controls.colors', { count: options.maxColors || 128 })}</span>
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
            {t('controls.paletteDesc')}
          </p>
        </div>

        {/* Filter Speckle */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-neutral-300">{t('controls.filterSpeckle')}</span>
            <span className="font-mono text-indigo-400">{t('controls.speckleUnit', { count: options.filterSpeckle })}</span>
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
            {t('controls.speckleDesc')}
          </p>
        </div>

        {/* Layer Difference */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-neutral-300">{t('controls.layerStep')}</span>
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
            {t('controls.layerStepDesc')}
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
            {t('controls.advanced')}
          </span>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-1">
            {/* Color Precision (Bits) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-300">{t('controls.colorPrecision')}</span>
                <span className="font-mono text-indigo-400">{t('controls.bits', { count: options.colorPrecision })}</span>
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
                <span className="text-neutral-300">{t('controls.cornerThreshold')}</span>
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
                <span className="text-neutral-300">{t('controls.segmentLength')}</span>
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
                <span className="text-neutral-300">{t('controls.maxIterations')}</span>
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
                <span className="text-neutral-300">{t('controls.svgPrecision')}</span>
                <span className="font-mono text-indigo-400">{t('controls.decimals', { count: options.pathPrecision })}</span>
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
        {hasImage &&
          typeof generationsRemaining === 'number' &&
          (generationsMax ?? generationsRemaining) < 9000 && (
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium ${
                generationsRemaining > 0
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                {t('controls.generationsLeft')}
              </span>
              <span className="font-bold">
                {generationsRemaining}/{generationsMax ?? generationsRemaining}
              </span>
            </div>
          )}
        <div className="flex items-center justify-between rounded-lg bg-neutral-800/30 px-3 py-2 border border-neutral-800">
          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>{t('controls.autoTrace')}</span>
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
          className={`relative group flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 shadow-lg ${!hasImage
            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            : isProcessing
              ? 'bg-indigo-700 text-white cursor-wait animate-pulse'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/35 active:scale-[0.99]'
            }`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{statusText || t('controls.vectorizing')}</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>{t('controls.vectorize')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
