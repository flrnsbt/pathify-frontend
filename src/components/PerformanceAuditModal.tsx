'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, Play, CheckCircle2, AlertTriangle, Cpu, HardDrive, Activity } from 'lucide-react';
import { useVTracer } from '../hooks/useVTracer';
import { DEFAULT_VTRACER_OPTIONS } from '../lib/vtracer/types';
import { useI18n } from '../lib/i18n';

interface PerformanceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BenchmarkResult {
  resolutionLabel: string;
  width: number;
  height: number;
  megapixels: string;
  timeMs: number;
  nodeCount: number;
  svgSizeKb: string;
  status: 'passed' | 'failed';
  error?: string;
}

export function PerformanceAuditModal({ isOpen, onClose }: PerformanceAuditModalProps) {
  const { t } = useI18n();
  const { vectorize } = useVTracer();
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  if (!isOpen) return null;

  const runBenchmark = async () => {
    setIsRunning(true);
    setResults([]);

    const tests = [
      { label: '1080p FHD', width: 1920, height: 1080 },
      { label: '2K QHD', width: 2560, height: 1440 },
      { label: '4K UHD', width: 3840, height: 2160 },
    ];

    const newResults: BenchmarkResult[] = [];

    for (const test of tests) {
      setCurrentTest(t('modals.audit.generating', { label: test.label, width: test.width, height: test.height }));
      await new Promise((r) => setTimeout(r, 50));

      try {
        // Generate high-density pattern on offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = test.width;
        canvas.height = test.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        // Draw multiple geometric shapes and gradients
        const grad = ctx.createRadialGradient(
          test.width / 2,
          test.height / 2,
          50,
          test.width / 2,
          test.height / 2,
          test.width / 2
        );
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(0.5, '#ec4899');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, test.width, test.height);

        // Grid of circles and polygons
        ctx.fillStyle = '#ffffff';
        const step = Math.round(test.width / 24);
        for (let y = step; y < test.height; y += step * 2) {
          for (let x = step; x < test.width; x += step * 2) {
            ctx.beginPath();
            ctx.arc(x, y, step / 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        const imageData = ctx.getImageData(0, 0, test.width, test.height);

        setCurrentTest(t('modals.audit.vectorizing', { label: test.label }));
        const startTime = performance.now();

        const svg = await vectorize(imageData, {
          ...DEFAULT_VTRACER_OPTIONS,
          filterSpeckle: 8,
          colorPrecision: 5,
        });

        const timeMs = Math.round(performance.now() - startTime);
        const nodeCount = (svg.match(/<path/g) || []).length;
        const svgSizeKb = (new Blob([svg]).size / 1024).toFixed(1);

        const res: BenchmarkResult = {
          resolutionLabel: test.label,
          width: test.width,
          height: test.height,
          megapixels: ((test.width * test.height) / 1_000_000).toFixed(2),
          timeMs,
          nodeCount,
          svgSizeKb,
          status: 'passed',
        };

        newResults.push(res);
        setResults([...newResults]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        newResults.push({
          resolutionLabel: test.label,
          width: test.width,
          height: test.height,
          megapixels: ((test.width * test.height) / 1_000_000).toFixed(2),
          timeMs: 0,
          nodeCount: 0,
          svgSizeKb: '0',
          status: 'failed',
          error: msg,
        });
        setResults([...newResults]);
      }
    }

    setIsRunning(false);
    setCurrentTest('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {t('modals.audit.title')}
              </h2>
              <p className="text-xs text-neutral-400">
                {t('modals.audit.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Audit Specs */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              {t('modals.audit.execution')}
            </span>
            <div className="text-sm font-semibold text-white mt-1">{t('modals.audit.executionValue')}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
              {t('modals.audit.memoryEngine')}
            </span>
            <div className="text-sm font-semibold text-white mt-1">{t('modals.audit.memoryValue')}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              {t('modals.audit.targetResolution')}
            </span>
            <div className="text-sm font-semibold text-white mt-1">Up to 4K (3840×2160)</div>
          </div>
        </div>

        {/* Live Status indicator */}
        {isRunning && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span>{currentTest}</span>
          </div>
        )}

        {/* Results Table */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400">
              <tr>
                <th className="p-3">{t('modals.audit.colProfile')}</th>
                <th className="p-3">{t('modals.audit.colResolution')}</th>
                <th className="p-3">{t('modals.audit.colTime')}</th>
                <th className="p-3">{t('modals.audit.colPaths')}</th>
                <th className="p-3">{t('modals.audit.colSize')}</th>
                <th className="p-3">{t('modals.audit.colResult')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    {t('modals.audit.empty')}
                  </td>
                </tr>
              ) : (
                results.map((r, i) => (
                  <tr key={i} className="hover:bg-neutral-900/40">
                    <td className="p-3 font-medium text-white">{r.resolutionLabel}</td>
                    <td className="p-3 font-mono text-neutral-300">
                      {r.width} × {r.height} ({r.megapixels} MP)
                    </td>
                    <td className="p-3 font-mono text-neutral-300">{r.timeMs} ms</td>
                    <td className="p-3 font-mono text-neutral-300">{r.nodeCount}</td>
                    <td className="p-3 font-mono text-neutral-300">{r.svgSizeKb} KB</td>
                    <td className="p-3">
                      {r.status === 'passed' ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('modals.audit.pass')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 font-semibold" title={r.error}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t('modals.audit.fail')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Trigger */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-neutral-800">
          <span className="text-xs text-neutral-500">
            {t('modals.audit.footerNote')}
          </span>
          <button
            type="button"
            disabled={isRunning}
            onClick={runBenchmark}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-md shadow-emerald-600/20"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            <span>{isRunning ? t('modals.audit.benchmarking') : t('modals.audit.runTest')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
