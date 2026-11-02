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
} from 'lucide-react';
import { LoadedImageInfo } from './Uploader';

interface VisualizerProps {
  originalImage: LoadedImageInfo | null;
  svg: string | null;
  nodeCount: number;
  executionTimeMs: number;
  isProcessing: boolean;
  onSaveToHistory?: () => void;
}

type ViewMode = 'split' | 'side-by-side' | 'vector' | 'raster';
type BgMode = 'checker' | 'dark' | 'light';

export function Visualizer({
  originalImage,
  svg,
  nodeCount,
  executionTimeMs,
}: VisualizerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [bgMode, setBgMode] = useState<BgMode>('checker');
  const [splitPos, setSplitPos] = useState<number>(50); // percentage 0 - 100
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

  // Handle Split bar dragging
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSplit && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const newPct = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        setSplitPos(newPct);
      } else if (isPanning) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
      setIsPanning(false);
    };

    if (isDraggingSplit || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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

  // Download SVG
  const handleDownloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (originalImage?.fileName ? originalImage.fileName.replace(/\.[^/.]+$/, '') : 'vector') + '.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy SVG Code
  const handleCopyCode = async () => {
    if (!svg) return;
    await navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-xl backdrop-blur-sm overflow-hidden h-full">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-3 gap-2">
        {/* View Mode Selectors */}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-950/80 p-1 border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            title="Split-Screen Slider"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Split className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Split Slider</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('side-by-side')}
            title="Side-by-Side View"
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
            title="Vector SVG Only"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'vector' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Vector</span>
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

          {/* Export Actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!svg}
              onClick={handleCopyCode}
              title="Copy SVG Code"
              className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-800/80 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white disabled:opacity-40 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              disabled={!svg}
              onClick={handleDownloadSvg}
              title="Download .SVG File"
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download SVG</span>
            </button>

            <button
              type="button"
              disabled={!svg}
              onClick={() => setShowCode(!showCode)}
              title="Toggle SVG Code Preview"
              className="p-1.5 text-neutral-400 hover:text-white transition rounded-lg border border-neutral-800 bg-neutral-800/50"
            >
              <FileCode className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

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
              Upload an image or pick a sample preset from the left panel to begin vectorizing with VTracer WASM.
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
            {/* Split Slider Mode */}
            {viewMode === 'split' && (
              <div
                className="relative flex items-center justify-center shadow-2xl"
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
                  className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* On Top: Vector SVG clipped by split percentage */}
                {svg && (
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                    style={{
                      clipPath: `polygon(${splitPos}% 0, 100% 0, 100% 100%, ${splitPos}% 100%)`,
                    }}
                  >
                    <div
                      className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>
                )}

                {/* Vertical Divider Handle */}
                {svg && (
                  <div
                    onMouseDown={handleSplitMouseDown}
                    className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center shadow-lg hover:w-1.5 transition-all z-20"
                    style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-white shadow-xl border border-neutral-700 text-[10px]">
                      ↔
                    </div>
                  </div>
                )}

                {/* Labels */}
                <span className="absolute top-3 left-3 rounded-md bg-neutral-950/80 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 border border-neutral-800">
                  Raster
                </span>
                <span className="absolute top-3 right-3 rounded-md bg-indigo-950/90 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-700/50">
                  Vector (SVG)
                </span>
              </div>
            )}

            {/* Side by Side Mode */}
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
                      alt="Original"
                      className="max-h-[65vh] w-auto object-contain"
                    />
                  </div>
                </div>

                {/* Vector SVG */}
                <div className="flex flex-col items-center">
                  <span className="mb-2 text-xs font-semibold text-indigo-400">Traced Vector SVG</span>
                  <div
                    className="overflow-hidden rounded-xl border border-indigo-500/30 bg-neutral-900/50 shadow-xl"
                    style={{ maxWidth: '40vw', maxHeight: '70vh' }}
                  >
                    {svg ? (
                      <div
                        className="max-h-[65vh] w-auto [&>svg]:max-h-[65vh] [&>svg]:w-auto [&>svg]:object-contain"
                        dangerouslySetInnerHTML={{ __html: svg }}
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

            {/* Vector Only Mode */}
            {viewMode === 'vector' && (
              <div className="flex items-center justify-center">
                {svg ? (
                  <div
                    className="max-h-[75vh] max-w-[85vw] [&>svg]:max-h-[75vh] [&>svg]:max-w-[85vw] [&>svg]:object-contain"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <div className="text-xs text-neutral-400">Click &quot;Vectorize&quot; to generate SVG</div>
                )}
              </div>
            )}

            {/* Raster Only Mode */}
            {viewMode === 'raster' && (
              <div className="flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalImage.dataUrl}
                  alt="Original"
                  className="max-h-[75vh] max-w-[85vw] object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* Floating Code Preview Modal/Drawer */}
        {showCode && svg && (
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
          {svg ? (
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
