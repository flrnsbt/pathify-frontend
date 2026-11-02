'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Columns,
  Split,
  Eye,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  Lock,
  Info,
} from 'lucide-react';
import { LoadedImageInfo } from './Uploader';

interface VisualizerProps {
  originalImage: LoadedImageInfo | null;
  svg: string | null;
  previewWebpUrl: string | null;
  nodeCount: number;
  executionTimeMs: number;
  isUnlocked: boolean;
  isProcessing?: boolean;
  statusText?: string;
  onRequestDownload: () => void;
  onRequestCopyCode: () => void;
}

type ViewMode = 'vector' | 'side-by-side' | 'split' | 'raster';
type BgMode = 'checker' | 'dark' | 'light';

export function Visualizer({
  originalImage,
  svg,
  previewWebpUrl,
  nodeCount,
  executionTimeMs,
  isUnlocked,
  isProcessing = false,
  statusText = '',
  onRequestDownload,
  onRequestCopyCode,
}: VisualizerProps) {
  // Default to full 'vector' or 'side-by-side' mode so user does not see split cut
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [bgMode, setBgMode] = useState<BgMode>('checker');
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Reset zoom & pan when image changes using render-time prop comparison
  const [prevDataUrl, setPrevDataUrl] = useState<string | undefined>(originalImage?.dataUrl);
  if (originalImage?.dataUrl !== prevDataUrl) {
    setPrevDataUrl(originalImage?.dataUrl);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSplitPos(50);
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);

  // Handle Split bar dragging start (mouse & touch)
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSplit(true);
  };

  const handleSplitTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    let animId: number | null = null;

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (isDraggingSplit) {
        // Measure relative to actual rendered image box for 100% accurate tracking
        const targetElement = imageBoxRef.current || containerRef.current;
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          const offsetX = clientX - rect.left;
          const newPct = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
          if (animId) cancelAnimationFrame(animId);
          animId = requestAnimationFrame(() => {
            setSplitPos(newPct);
          });
        }
      } else if (isPanning) {
        if (animId) cancelAnimationFrame(animId);
        animId = requestAnimationFrame(() => {
          setPan({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y,
          });
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handlePointerUp = () => {
      setIsDraggingSplit(false);
      setIsPanning(false);
      if (animId) cancelAnimationFrame(animId);
    };

    if (isDraggingSplit || isPanning) {
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handlePointerUp);
    }

    return () => {
      document.body.style.userSelect = '';
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDraggingSplit, isPanning, dragStart]);

  // Handle Pan start
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement || isDraggingSplit) return;
    setIsPanning(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(10, +(z * 1.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.1, +(z / 1.25).toFixed(2)));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCopyClick = async () => {
    if (!isUnlocked) {
      onRequestCopyCode();
      return;
    }
    if (svg) {
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleCode = () => {
    if (!isUnlocked) {
      onRequestCopyCode();
      return;
    }
    setShowCode(!showCode);
  };

  // SVG Size calculation
  const svgSizeBytes = svg ? new Blob([svg]).size : 0;
  const originalSizeBytes = originalImage?.fileSize || 0;
  const compressionRatio =
    originalSizeBytes > 0 && svgSizeBytes > 0
      ? (svgSizeBytes / originalSizeBytes).toFixed(2)
      : null;

  const bgClasses: Record<BgMode, string> = {
    checker:
      'bg-[linear-gradient(45deg,#1f1f23_25%,transparent_25%),linear-gradient(-45deg,#1f1f23_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f23_75%),linear-gradient(-45deg,transparent_75%,#1f1f23_75%)] bg-[size:16px_16px] bg-neutral-900',
    dark: 'bg-neutral-950',
    light: 'bg-white',
  };

  // Display image source: high-quality WebP bitmap to prevent SVG extraction
  const renderedVectorImage = previewWebpUrl;

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-xl backdrop-blur-sm overflow-hidden h-full">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-3 gap-2">
        {/* View Mode Selectors */}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-950/80 p-1 border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode('side-by-side')}
            title="Side-by-Side Comparison"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'side-by-side' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Side by Side</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('vector')}
            title="Full Vector View"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'vector' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Vector View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            title="Split-Screen Comparison Slider"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Split className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Split Slider</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raster')}
            title="Original Raster Only"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'raster' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Raster</span>
          </button>
        </div>

        {/* Zoom & Canvas Controls */}
        <div className="flex items-center gap-1.5">
          {/* Background Toggle */}
          <div className="flex items-center rounded-lg bg-neutral-950/80 p-0.5 border border-neutral-800 text-[11px]">
            <button
              type="button"
              onClick={() => setBgMode('checker')}
              className={`rounded px-1.5 py-0.5 ${bgMode === 'checker' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title="Checkerboard Grid"
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setBgMode('dark')}
              className={`rounded px-1.5 py-0.5 ${bgMode === 'dark' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title="Dark Background"
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setBgMode('light')}
              className={`rounded px-1.5 py-0.5 ${bgMode === 'light' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title="Light Background"
            >
              Light
            </button>
          </div>

          {/* Zoom In/Out/Reset */}
          <div className="flex items-center rounded-lg bg-neutral-950/80 p-0.5 border border-neutral-800">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-neutral-400 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-neutral-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-neutral-400 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="p-1 text-neutral-400 hover:text-white transition border-l border-neutral-800 ml-0.5"
              title="Reset Zoom & Pan"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Export Actions with Access Protection */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!renderedVectorImage}
              onClick={handleCopyClick}
              title={isUnlocked ? 'Copy SVG Code' : 'Unlock to copy SVG code'}
              className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-800/80 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white disabled:opacity-40 transition"
            >
              {!isUnlocked ? (
                <Lock className="h-3.5 w-3.5 text-amber-400" />
              ) : copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {!isUnlocked ? 'Copy SVG' : copied ? 'Copied' : 'Copy'}
              </span>
            </button>

            <button
              type="button"
              disabled={!renderedVectorImage}
              onClick={onRequestDownload}
              title={isUnlocked ? 'Download .SVG File' : 'Unlock with credit to download SVG'}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-40 ${
                isUnlocked
                  ? 'border-emerald-500/30 bg-emerald-600 hover:bg-emerald-500'
                  : 'border-indigo-500/40 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
              }`}
            >
              {isUnlocked ? (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download SVG</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-amber-300" />
                  <span>Download SVG</span>
                </>
              )}
            </button>

            {isUnlocked && (
              <button
                type="button"
                onClick={handleToggleCode}
                title="Toggle Raw SVG Code"
                className="p-1.5 text-neutral-400 hover:text-white transition rounded-lg border border-neutral-800 bg-neutral-800/50"
              >
                <FileCode className="h-4 w-4 text-emerald-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quality Preview Notice */}
      {renderedVectorImage && (
        <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950/70 px-4 py-2 text-[11px] text-neutral-400">
          <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span>
            <strong className="text-neutral-300">Preview Notice:</strong> This viewer displays an anti-theft raster preview. The actual vector SVG has infinite mathematical resolution and zero pixelation — download the SVG to inspect the true vector result.
          </span>
        </div>
      )}

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handlePanMouseDown}
        className={`relative flex-1 min-h-[460px] overflow-hidden select-none cursor-grab active:cursor-grabbing ${bgClasses[bgMode]}`}
      >
        {!originalImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800/50 text-neutral-500 mb-3 border border-neutral-700/50">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-neutral-300 text-base">No Image Loaded</h3>
            <p className="mt-1 max-w-sm text-xs text-neutral-500">
              Upload an image or pick a sample preset to begin vectorizing.
            </p>
          </div>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Side by Side Mode (DEFAULT) */}
            {viewMode === 'side-by-side' && (
              <div className="flex items-center justify-center gap-6 p-4">
                {/* Original */}
                <div className="flex flex-col items-center">
                  <span className="mb-2 text-xs font-semibold text-neutral-400">Original Raster</span>
                  <div
                    className="overflow-hidden rounded-xl border border-neutral-800 shadow-xl"
                    style={{ maxWidth: '40vw', maxHeight: '70vh' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={originalImage.dataUrl}
                      alt="Original Raster"
                      draggable={false}
                      className="max-h-[65vh] w-auto object-contain select-none pointer-events-none"
                    />
                  </div>
                </div>

                {/* Vectorized Result */}
                <div className="flex flex-col items-center">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                    <span>Vectorized Result</span>
                    {isUnlocked && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <div
                    className="overflow-hidden rounded-xl border border-indigo-500/30 bg-neutral-900/50 shadow-xl relative"
                    style={{ maxWidth: '40vw', maxHeight: '70vh' }}
                  >
                    {renderedVectorImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={renderedVectorImage}
                        alt="Vectorized Result (High Quality WebP Bitmap)"
                        draggable={false}
                        className="max-h-[65vh] w-auto object-contain select-none pointer-events-none"
                      />
                    ) : (
                      <div className="flex h-64 w-64 items-center justify-center text-xs text-neutral-500">
                        Pending vectorization...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Vector View Mode */}
            {viewMode === 'vector' && (
              <div className="flex items-center justify-center">
                {renderedVectorImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={renderedVectorImage}
                    alt="Vectorized Result (High Quality WebP Bitmap)"
                    draggable={false}
                    className="max-h-[75vh] max-w-[85vw] object-contain select-none pointer-events-none shadow-2xl"
                  />
                ) : (
                  <div className="text-xs text-neutral-400">Click &quot;Vectorize&quot; to generate output</div>
                )}
              </div>
            )}

            {/* Split Slider Mode */}
            {viewMode === 'split' && (
              <div
                ref={imageBoxRef}
                className="relative flex items-center justify-center shadow-2xl select-none"
                style={{
                  width: originalImage.width,
                  height: originalImage.height,
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                }}
              >
                {/* Underneath: Raster Original */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalImage.dataUrl}
                  alt="Original Raster"
                  draggable={false}
                  className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* On Top: Vector WebP clipped by split percentage */}
                {renderedVectorImage && (
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                    style={{
                      clipPath: `polygon(${splitPos}% 0, 100% 0, 100% 100%, ${splitPos}% 100%)`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderedVectorImage}
                      alt="Vector WebP Preview"
                      draggable={false}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  </div>
                )}

                {/* Vertical Divider Handle (Instant tracking without transition lag) */}
                {renderedVectorImage && (
                  <div
                    onMouseDown={handleSplitMouseDown}
                    onTouchStart={handleSplitTouchStart}
                    className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center shadow-2xl z-20 group"
                    style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-white shadow-2xl border-2 border-indigo-500 text-xs font-bold ring-4 ring-black/40 group-hover:scale-110 active:scale-95 transition-transform cursor-ew-resize">
                      ↔
                    </div>
                  </div>
                )}

                {/* Labels */}
                <span className="absolute top-3 left-3 rounded-md bg-neutral-950/80 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 border border-neutral-800">
                  Raster
                </span>
                <span className="absolute top-3 right-3 rounded-md bg-indigo-950/90 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-700/50">
                  Vector Preview
                </span>
              </div>
            )}

            {/* Raster Only Mode */}
            {viewMode === 'raster' && (
              <div className="flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalImage.dataUrl}
                  alt="Original Raster"
                  draggable={false}
                  className="max-h-[75vh] max-w-[85vw] object-contain select-none pointer-events-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Fancy Loading Indicator on Top of Viewer */}
        {isProcessing && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150">
            {/* Top scanning laser beam */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 via-pink-500 to-transparent animate-pulse" />

            {/* Futuristic Glassmorphism Card */}
            <div className="relative flex flex-col items-center max-w-xs sm:max-w-sm mx-4 p-6 rounded-3xl border border-indigo-500/30 bg-neutral-950/90 shadow-2xl shadow-indigo-500/25 text-center backdrop-blur-md animate-in zoom-in-95 duration-150">
              {/* Outer pulsing ring glow */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute h-20 w-20 rounded-full border-2 border-dashed border-indigo-500/40 animate-[spin_6s_linear_infinite]" />
                <div className="absolute h-24 w-24 rounded-full border border-purple-500/30 animate-ping opacity-25" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 p-0.5 shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icon.svg"
                    alt="processing"
                    className="h-full w-full rounded-2xl bg-neutral-950 p-1 object-contain"
                  />
                </div>
              </div>

              {/* Status Header Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-300 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>VECTORIZING RASTER</span>
              </div>

              <h4 className="text-sm font-bold text-white tracking-tight">
                {statusText || 'Tracing Vector Geometry...'}
              </h4>

              <p className="mt-1 text-[11px] text-neutral-400 max-w-xs leading-relaxed">
                Fitting high-precision Bezier splines and clustering color layers.
              </p>

              {/* Progress shimmer track */}
              <div className="mt-3.5 w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Floating Code Preview Modal (Only shown if unlocked) */}
        {showCode && svg && isUnlocked && (
          <div className="absolute inset-x-4 bottom-4 top-16 z-30 rounded-xl border border-neutral-700 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <span className="text-xs font-semibold text-neutral-300">SVG Output Markup</span>
              <button
                type="button"
                onClick={() => setShowCode(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <pre className="mt-3 flex-1 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs font-mono text-emerald-400">
              {svg}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between border-t border-neutral-800 bg-neutral-950/90 px-4 py-2.5 text-xs text-neutral-400 gap-2">
        <div className="flex items-center gap-4">
          {renderedVectorImage ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                Traced in {executionTimeMs} ms
              </span>
              <span className="hidden sm:inline font-mono">
                Paths/Nodes: <strong className="text-neutral-200">{nodeCount}</strong>
              </span>
              <span className="hidden md:inline font-mono">
                SVG: {(svgSizeBytes / 1024).toFixed(1)} KB
              </span>
              {compressionRatio && (
                <span className="hidden lg:inline text-neutral-500">
                  (Ratio: {compressionRatio}x of raster)
                </span>
              )}
            </>
          ) : (
            <span>Ready to trace</span>
          )}
        </div>

        {originalImage && (
          <div className="flex items-center gap-2 text-neutral-500 font-mono text-[11px]">
            <span>
              {originalImage.width} × {originalImage.height} px
            </span>
            <span>•</span>
            <span>{(originalImage.fileSize / 1024).toFixed(1)} KB</span>
          </div>
        )}
      </div>
    </div>
  );
}
