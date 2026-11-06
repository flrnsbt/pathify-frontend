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
  ChevronDown,
} from 'lucide-react';
import { LoadedImageInfo } from './Uploader';
import { exportRasterImage } from '../lib/raster/export';
import { useI18n } from '../lib/i18n';

interface VisualizerProps {
  originalImage: LoadedImageInfo | null;
  svg: string | null;
  previewWebpUrl: string | null;
  nodeCount: number;
  executionTimeMs: number;
  isUnlocked: boolean;
  generationsRemaining?: number;
  generationsMax?: number;
  isProcessing?: boolean;
  statusText?: string;
  onRequestDownload: () => void;
  // Validates the generation (quota + history) — resolves true when export is allowed
  onRequestCopyCode: () => Promise<boolean>;
  onLoadSample?: (type: 'logo' | 'pixel' | 'badge') => void;
}

type ViewMode = 'vector' | 'side-by-side' | 'split' | 'raster' | 'code';
type BgMode = 'checker' | 'dark' | 'light';

/**
 * Adapts an SVG markup string to render at a target high resolution while preserving
 * the original vector aspect ratio and viewBox coordinate space.
 * Eliminates blurry/pixelated artifacts on HTML5 canvas during high-DPI and zoom.
 */
function adaptSvgForResolution(
  svgString: string,
  targetWidth: number,
  targetHeight: number,
  originalWidth?: number,
  originalHeight?: number
): string {
  let adapted = svgString;

  // 1. Ensure a valid viewBox exists matching original coordinates
  if (!/viewBox\s*=/i.test(adapted)) {
    const origW = originalWidth || targetWidth;
    const origH = originalHeight || targetHeight;
    adapted = adapted.replace(/<svg\b([^>]*)>/i, `<svg$1 viewBox="0 0 ${origW} ${origH}">`);
  }

  // 2. Set explicit width and height on root <svg> matching target high-res rendering size
  adapted = adapted.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const cleanAttrs = attrs
      .replace(/\bwidth\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bheight\s*=\s*["'][^"']*["']/gi, '')
      .trim();
    return `<svg width="${targetWidth}" height="${targetHeight}" ${cleanAttrs}>`;
  });

  return adapted;
}

/**
 * HTML5 Canvas Vector Renderer
 * Directly paints vector SVG / raster onto a hardware-accelerated 2D canvas context.
 * Smartly adapts SVG rasterization size to current zoom level & DPR to prevent pixelation.
 */
function VectorCanvas({
  svg,
  fallbackUrl,
  width,
  height,
  zoom = 1,
  className = '',
  style = {},
}: {
  svg: string | null;
  fallbackUrl?: string | null;
  width: number;
  height: number;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [debouncedZoom, setDebouncedZoom] = useState(zoom);

  // Debounce resolution adaptation during rapid continuous zoom gestures (80ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedZoom(zoom);
    }, 80);
    return () => clearTimeout(timer);
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!svg && !fallbackUrl)) return;

    let active = true;
    let objectUrl: string | null = null;
    const img = new Image();

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
    const baseW = width || 800;
    const baseH = height || 800;

    // Smartly adapt canvas pixel density to the current zoom level to avoid pixelation
    const effectiveZoom = Math.max(1, debouncedZoom);
    const maxDimension = 4096;
    const maxScale = Math.min(maxDimension / baseW, maxDimension / baseH, 4 * dpr);
    const scaleFactor = Math.min(Math.max(dpr * effectiveZoom, dpr), maxScale);

    const targetW = Math.round(baseW * scaleFactor);
    const targetH = Math.round(baseH * scaleFactor);

    img.onload = () => {
      if (!active || !canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      canvas.width = targetW;
      canvas.height = targetH;

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);
    };

    if (svg) {
      const adaptedSvg = adaptSvgForResolution(svg, targetW, targetH, width, height);
      const blob = new Blob([adaptedSvg], { type: 'image/svg+xml;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
    } else if (fallbackUrl) {
      img.src = fallbackUrl;
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [svg, fallbackUrl, width, height, debouncedZoom]);

  return (
    <canvas
      ref={canvasRef}
      className={`select-none pointer-events-none block ${className}`}
      style={{
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

/**
 * HTML5 Canvas Split Comparison Renderer
 * Uses 2D canvas clipping to composite raster & vector results with zero lag.
 * Smartly scales vector layer resolution based on camera zoom.
 */
function SplitSliderCanvas({
  rasterUrl,
  svg,
  fallbackUrl,
  width,
  height,
  splitPos,
  zoom = 1,
  className = '',
  style = {},
}: {
  rasterUrl: string;
  svg: string | null;
  fallbackUrl?: string | null;
  width: number;
  height: number;
  splitPos: number;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rasterImgRef = useRef<HTMLImageElement | null>(null);
  const vectorImgRef = useRef<HTMLImageElement | null>(null);
  const [debouncedZoom, setDebouncedZoom] = useState(zoom);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedZoom(zoom);
    }, 80);
    return () => clearTimeout(timer);
  }, [zoom]);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const raster = rasterImgRef.current;
    const vector = vectorImgRef.current;
    if (!canvas || !raster) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
    const baseW = width || raster.naturalWidth || 400;
    const baseH = height || raster.naturalHeight || 400;

    const effectiveZoom = Math.max(1, debouncedZoom);
    const maxDimension = 4096;
    const maxScale = Math.min(maxDimension / baseW, maxDimension / baseH, 4 * dpr);
    const scaleFactor = Math.min(Math.max(dpr * effectiveZoom, dpr), maxScale);

    const targetW = Math.round(baseW * scaleFactor);
    const targetH = Math.round(baseH * scaleFactor);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw raster original base
    ctx.drawImage(raster, 0, 0, targetW, targetH);

    // 2. Draw vector in clipped region
    if (vector) {
      const splitX = Math.round((targetW * splitPos) / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, targetW - splitX, targetH);
      ctx.clip();
      ctx.drawImage(vector, 0, 0, targetW, targetH);
      ctx.restore();
    }
  }, [width, height, splitPos, debouncedZoom]);

  useEffect(() => {
    let active = true;
    const rImg = new Image();
    rImg.onload = () => {
      if (!active) return;
      rasterImgRef.current = rImg;
      draw();
    };
    rImg.src = rasterUrl;
    return () => {
      active = false;
    };
  }, [rasterUrl, draw]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const vImg = new Image();
    vImg.onload = () => {
      if (!active) return;
      vectorImgRef.current = vImg;
      draw();
    };

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
    const baseW = width || 800;
    const baseH = height || 800;
    const effectiveZoom = Math.max(1, debouncedZoom);
    const scaleFactor = Math.min(Math.max(dpr * effectiveZoom, dpr), 4 * dpr);
    const targetW = Math.round(baseW * scaleFactor);
    const targetH = Math.round(baseH * scaleFactor);

    if (svg) {
      const adaptedSvg = adaptSvgForResolution(svg, targetW, targetH, width, height);
      const blob = new Blob([adaptedSvg], { type: 'image/svg+xml;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      vImg.src = objectUrl;
    } else if (fallbackUrl) {
      vImg.src = fallbackUrl;
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [svg, fallbackUrl, width, height, debouncedZoom, draw]);

  useEffect(() => {
    draw();
  }, [draw, splitPos]);

  return (
    <canvas
      ref={canvasRef}
      className={`select-none pointer-events-none block ${className}`}
      style={{
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

function formatXml(xml: string): string {
  if (!xml) return '';
  let formatted = '';
  let indent = 0;
  const clean = xml.replace(/>\s*</g, '>\n<');
  const lines = clean.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }
    formatted += '  '.repeat(indent) + line + '\n';
    if (
      line.startsWith('<') &&
      !line.startsWith('</') &&
      !line.endsWith('/>') &&
      !line.startsWith('<?') &&
      !line.startsWith('<!')
    ) {
      indent++;
    }
  }
  return formatted.trim();
}

export function Visualizer({
  originalImage,
  svg,
  previewWebpUrl,
  nodeCount,
  executionTimeMs,
  isUnlocked,
  generationsRemaining,
  generationsMax,
  isProcessing = false,
  statusText = '',
  onRequestDownload,
  onRequestCopyCode,
  onLoadSample,
}: VisualizerProps) {
  const { t } = useI18n();
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
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isExportingRaster, setIsExportingRaster] = useState<string | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  // Close download menu on click outside
  useEffect(() => {
    if (!isDownloadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDownloadMenuOpen]);

  // Handle switching view mode: resets camera zoom & pan to best default view
  const handleSelectViewMode = (newMode: ViewMode) => {
    setViewMode(newMode);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Export free raster (PNG or WebP) without requiring login or credits
  const handleDownloadRaster = async (format: 'png' | 'webp') => {
    if (!originalImage) return;
    setIsExportingRaster(format);
    try {
      await exportRasterImage({
        svg,
        fallbackDataUrl: renderedVectorImage,
        fileName: originalImage.fileName,
        format,
        width: originalImage.width,
        height: originalImage.height,
        scale: 2,
      });
    } catch (err) {
      console.error('Failed to export raster:', err);
    } finally {
      setIsExportingRaster(null);
      setIsDownloadMenuOpen(false);
    }
  };

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

  // Smooth mousewheel / pinch-to-zoom on canvas container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((z) => Math.max(0.1, Math.min(10, +(z * factor).toFixed(2))));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
    const allowed = await onRequestCopyCode();
    if (!allowed || !svg) return;
    await navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedSvg = React.useMemo(() => (svg ? formatXml(svg) : ''), [svg]);
  const formattedLines = React.useMemo(
    () => (formattedSvg ? formattedSvg.split('\n') : []),
    [formattedSvg]
  );

  const handleToggleCode = async () => {
    if (viewMode === 'code') {
      handleSelectViewMode('vector');
      return;
    }
    // Viewing SVG code counts as a validated generation — same gate as copy/download
    const allowed = await onRequestCopyCode();
    if (allowed) {
      handleSelectViewMode('code');
    }
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

  // Display image source: high-quality WebP bitmap, or instant SVG data fallback
  const renderedVectorImage =
    previewWebpUrl || (svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null);

  const hasRaster = Boolean(originalImage);

  // Dimensions for preview-only mode (history item whose source isn't local)
  const previewDims = React.useMemo(() => {
    if (originalImage) return { w: originalImage.width, h: originalImage.height };
    if (svg) {
      const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/);
      if (vb) {
        const nums = vb[1].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
        if (nums.length >= 4 && nums[2] > 0 && nums[3] > 0) {
          return { w: nums[2], h: nums[3] };
        }
      }
      const wh = svg.match(/<svg[^>]*\bwidth="([\d.]+)[^"]*"[^>]*\bheight="([\d.]+)[^"]*"/);
      if (wh) return { w: parseFloat(wh[1]) || 800, h: parseFloat(wh[2]) || 800 };
    }
    return { w: 800, h: 800 };
  }, [originalImage, svg]);

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-xl backdrop-blur-sm overflow-hidden h-full min-h-0">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-3 gap-2 shrink-0">
        {/* View Mode Selectors */}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-950/80 p-1 border border-neutral-800">
          {hasRaster && (
            <>
              <button
                type="button"
                onClick={() => handleSelectViewMode('side-by-side')}
                title={t('visualizer.sideBySideTitle')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'side-by-side' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Columns className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('visualizer.sideBySide')}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => handleSelectViewMode('vector')}
            title={t('visualizer.vectorTitle')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'vector' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{t('visualizer.vectorView')}</span>
          </button>
          {hasRaster && (
            <>
              <button
                type="button"
                onClick={() => handleSelectViewMode('split')}
                title={t('visualizer.splitTitle')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Split className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('visualizer.split')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectViewMode('raster')}
                title={t('visualizer.rasterTitle')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'raster' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{t('visualizer.raster')}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleToggleCode}
            title={t('visualizer.codeTitle')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'code' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileCode className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t('visualizer.svgCode')}</span>
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
              title={t('visualizer.bgGridTitle')}
            >
              {t('visualizer.bgGrid')}
            </button>
            <button
              type="button"
              onClick={() => setBgMode('dark')}
              className={`rounded px-1.5 py-0.5 ${bgMode === 'dark' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title={t('visualizer.bgDarkTitle')}
            >
              {t('visualizer.bgDark')}
            </button>
            <button
              type="button"
              onClick={() => setBgMode('light')}
              className={`rounded px-1.5 py-0.5 ${bgMode === 'light' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title={t('visualizer.bgLightTitle')}
            >
              {t('visualizer.bgLight')}
            </button>
          </div>

          {/* Zoom In/Out/Reset */}
          <div className="flex items-center rounded-lg bg-neutral-950/80 p-0.5 border border-neutral-800">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-neutral-400 hover:text-white transition"
              title={t('visualizer.zoomOut')}
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
              title={t('visualizer.zoomIn')}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="p-1 text-neutral-400 hover:text-white transition border-l border-neutral-800 ml-0.5"
              title={t('visualizer.resetZoom')}
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
              title={isUnlocked ? t('visualizer.copySvgTitle') : t('visualizer.copySvgLockedTitle')}
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
                {!isUnlocked ? t('visualizer.copySvg') : copied ? t('common.copied') : t('common.copy')}
              </span>
            </button>

            {/* Download Button with Free Raster (PNG/WebP) Dropdown */}
            <div ref={downloadMenuRef} className="relative inline-flex items-center">
              <button
                type="button"
                disabled={!renderedVectorImage}
                onClick={onRequestDownload}
                title={isUnlocked ? t('visualizer.downloadSvgTitle') : t('visualizer.downloadSvgLockedTitle')}
                className={`flex items-center gap-1.5 rounded-l-lg border-y border-l px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-40 ${
                  isUnlocked
                    ? 'border-emerald-500/30 bg-emerald-600 hover:bg-emerald-500'
                    : 'border-indigo-500/40 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
                }`}
              >
                {isUnlocked ? (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>{t('visualizer.downloadSvg')}</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-amber-300" />
                    <span>{t('visualizer.downloadSvg')}</span>
                  </>
                )}
              </button>

              {/* Free Export Dropdown Trigger */}
              <button
                type="button"
                disabled={!renderedVectorImage}
                onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
                title={t('visualizer.menuTitle')}
                className={`flex items-center justify-center rounded-r-lg border px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40 ${
                  isUnlocked
                    ? 'border-emerald-500/30 bg-emerald-700 hover:bg-emerald-600'
                    : 'border-indigo-500/40 bg-purple-700 hover:bg-purple-600'
                }`}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Free Formats Menu Dropdown */}
              {isDownloadMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                    {t('visualizer.formats')}
                  </div>

                  {/* 1. SVG Vector (Lossless, requires unlock/credits) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadMenuOpen(false);
                      onRequestDownload();
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-neutral-800/80 transition"
                  >
                    <div className="mt-0.5 rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400 border border-indigo-500/20">
                      <Download className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{t('visualizer.svgVector')}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold ${
                            isUnlocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isUnlocked ? t('visualizer.unlocked') : t('visualizer.oneCredit')}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {t('visualizer.svgVectorDesc')}
                      </p>
                    </div>
                  </button>

                  <div className="my-1 border-t border-neutral-800/80" />
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                    <span>{t('visualizer.freeDownloads')}</span>
                    <span className="text-[9px] text-neutral-500 font-normal">{t('visualizer.noCredits')}</span>
                  </div>

                  {/* 2. Free PNG */}
                  <button
                    type="button"
                    disabled={Boolean(isExportingRaster)}
                    onClick={() => handleDownloadRaster('png')}
                    className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-neutral-800/80 transition disabled:opacity-50"
                  >
                    <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400 border border-emerald-500/20">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{t('visualizer.png')}</span>
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-emerald-300">
                          {isExportingRaster === 'png' ? t('visualizer.exporting') : t('visualizer.free')}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {t('visualizer.pngDesc')}
                      </p>
                    </div>
                  </button>

                  {/* 3. Free WebP */}
                  <button
                    type="button"
                    disabled={Boolean(isExportingRaster)}
                    onClick={() => handleDownloadRaster('webp')}
                    className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-neutral-800/80 transition disabled:opacity-50"
                  >
                    <div className="mt-0.5 rounded-lg bg-cyan-500/10 p-1.5 text-cyan-400 border border-cyan-500/20">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{t('visualizer.webp')}</span>
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-emerald-300">
                          {isExportingRaster === 'webp' ? t('visualizer.exporting') : t('visualizer.free')}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {t('visualizer.webpDesc')}
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer / Browser Rendering Warning Notice */}
      {renderedVectorImage && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-neutral-800 bg-neutral-950/85 px-4 py-2.5 text-[11px] text-neutral-400 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-neutral-200">{t('visualizer.noticeStrong')}</strong>{t('visualizer.noticeRest')}
            </span>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas Area / Dedicated XML Code View */}
      {viewMode === 'code' ? (
        <div className="flex-1 min-h-[380px] lg:min-h-0 flex flex-col bg-neutral-950 font-mono text-xs select-text cursor-auto overflow-hidden">
          {/* Top Code Toolbar */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-2.5 text-xs text-neutral-300 shrink-0">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-white">{t('visualizer.svgSource')}</span>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">
                {nodeCount} nodes • {(svgSizeBytes / 1024).toFixed(1)} KB
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyClick}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-750 hover:text-white transition"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{t('common.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('visualizer.copyXml')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={Boolean(isExportingRaster)}
                onClick={() => handleDownloadRaster('png')}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-750 hover:text-white transition disabled:opacity-40"
                title={t('visualizer.pngFreeTitle')}
              >
                <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t('visualizer.pngFree')}</span>
              </button>
              <button
                type="button"
                disabled={Boolean(isExportingRaster)}
                onClick={() => handleDownloadRaster('webp')}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-750 hover:text-white transition disabled:opacity-40"
                title={t('visualizer.webpFreeTitle')}
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>{t('visualizer.webpFree')}</span>
              </button>
              <button
                type="button"
                onClick={onRequestDownload}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t('visualizer.downloadSvgFile')}</span>
              </button>
            </div>
          </div>

          {/* Interactive Code Area with Line Numbers */}
          <div className="flex-1 min-h-0 overflow-auto flex text-neutral-300 custom-scrollbar">
            {/* Line numbers gutter */}
            <div className="select-none py-3 pl-3 pr-2 text-right text-neutral-600 bg-neutral-950/80 border-r border-neutral-900 font-mono text-[11px] leading-relaxed shrink-0">
              {formattedLines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code content */}
            <pre className="flex-1 p-3 overflow-x-auto text-[11px] font-mono leading-relaxed select-text cursor-text text-neutral-200 whitespace-pre custom-scrollbar">
              <code>{formattedSvg || svg || t('visualizer.noSvg')}</code>
            </pre>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onMouseDown={handlePanMouseDown}
          className={`relative flex-1 min-h-[380px] lg:min-h-0 overflow-hidden select-none cursor-grab active:cursor-grabbing ${bgClasses[bgMode]}`}
        >
        {!originalImage && !svg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto bg-neutral-950">
            {/* Decorative ambient glows */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 left-[15%] h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl" />
              <div className="absolute -bottom-24 right-[15%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="absolute left-1/2 top-1/2 h-64 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col items-center">
            {/* Ambient Backlight Glow */}
            <div className="relative mb-4 flex items-center justify-center">
              <div className="absolute h-24 w-24 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="vectorizerr studio"
                className="relative h-16 w-16 rounded-2xl shadow-xl shadow-indigo-500/25 border border-white/10 p-0.5 object-contain hover:scale-105 transition-transform"
              />
            </div>

            <h3 className="font-bold text-white text-lg tracking-tight">
              {t('visualizer.noImage')}
            </h3>
            <p className="mt-1 max-w-md text-xs text-neutral-400 leading-relaxed">
              {t('visualizer.emptyDesc')}
            </p>

            {/* Quick-test Presets directly in workspace */}
            {onLoadSample && (
              <div className="mt-6 flex flex-col items-center gap-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  {t('uploader.trySample')}
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadSample('logo')}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-indigo-500/50 hover:bg-neutral-850 hover:text-white transition shadow-sm"
                  >
                    <span>🏞️</span>
                    <span>{t('uploader.sampleLogo')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadSample('pixel')}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-indigo-500/50 hover:bg-neutral-850 hover:text-white transition shadow-sm"
                  >
                    <span>👾</span>
                    <span>{t('uploader.samplePixel')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadSample('badge')}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-indigo-500/50 hover:bg-neutral-850 hover:text-white transition shadow-sm"
                  >
                    <span>🛡️</span>
                    <span>{t('uploader.sampleBadge')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Studio Capabilities Strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] text-neutral-500 border-t border-neutral-850/80 pt-4 max-w-lg">
              <span className="text-neutral-700">•</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>True Bézier Paths</span>
              </span>
              <span className="text-neutral-700">•</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span>100% Client-Side Privacy</span>
              </span>
            </div>
            </div>
          </div>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Preview-only mode: SVG restored without its source image */}
            {!hasRaster && svg && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <VectorCanvas
                  svg={svg}
                  fallbackUrl={renderedVectorImage}
                  width={previewDims.w}
                  height={previewDims.h}
                  zoom={zoom}
                  className="max-h-full max-w-full object-contain rounded-xl"
                />
              </div>
            )}

            {/* Side by Side Mode */}
            {originalImage && viewMode === 'side-by-side' && (
              <div className="flex items-center justify-center gap-4 sm:gap-6 p-2 sm:p-4 max-w-full max-h-full">
                {/* Original */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="mb-2 text-xs font-semibold text-neutral-400">{t('visualizer.originalRaster')}</span>
                  <div
                    className="rounded-2xl border border-neutral-800 bg-neutral-950/60 shadow-2xl p-1 flex items-center justify-center overflow-hidden"
                    style={{
                      width: 'min(42vw, 550px)',
                      aspectRatio: `${originalImage.width} / ${originalImage.height}`,
                      maxHeight: '68vh',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={originalImage.dataUrl}
                      alt={t('visualizer.originalRaster')}
                      draggable={false}
                      className="w-full h-full object-contain select-none pointer-events-none rounded-xl"
                    />
                  </div>
                </div>

                {/* Vectorized Result (HTML5 Canvas) */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                    <span>{t('visualizer.vectorizedResult')}</span>
                    <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
                      {t('visualizer.canvasVector')}
                    </span>
                    {typeof generationsRemaining === 'number' && generationsRemaining < 9000 && (
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-medium border ${
                          isUnlocked
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-neutral-800/60 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {isUnlocked ? t('visualizer.unlockedPrefix') : ''}
                        {t('visualizer.gensLeft', { remaining: generationsRemaining, max: generationsMax ?? generationsRemaining })}
                      </span>
                    )}
                  </div>
                  <div
                    className="rounded-2xl border border-indigo-500/30 bg-neutral-900/50 shadow-2xl p-1 relative flex items-center justify-center overflow-hidden"
                    style={{
                      width: 'min(42vw, 550px)',
                      aspectRatio: `${originalImage.width} / ${originalImage.height}`,
                      maxHeight: '68vh',
                    }}
                  >
                    {renderedVectorImage ? (
                      <VectorCanvas
                        svg={svg}
                        fallbackUrl={renderedVectorImage}
                        width={originalImage.width}
                        height={originalImage.height}
                        zoom={zoom}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center text-xs text-neutral-500">
                        {t('visualizer.pending')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Vector View Mode (HTML5 Canvas) */}
            {originalImage && viewMode === 'vector' && (
              <div className="flex items-center justify-center">
                {renderedVectorImage ? (
                  <VectorCanvas
                    svg={svg}
                    fallbackUrl={renderedVectorImage}
                    width={originalImage.width}
                    height={originalImage.height}
                    zoom={zoom}
                    className="max-h-[75vh] max-w-[85vw] object-contain shadow-2xl"
                  />
                ) : (
                  <div className="text-xs text-neutral-400">{t('visualizer.clickVectorize')}</div>
                )}
              </div>
            )}

            {/* Split Slider Mode (HTML5 Canvas Split Rendering) */}
            {originalImage && viewMode === 'split' && (
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
                <SplitSliderCanvas
                  rasterUrl={originalImage.dataUrl}
                  svg={svg}
                  fallbackUrl={renderedVectorImage}
                  width={originalImage.width}
                  height={originalImage.height}
                  splitPos={splitPos}
                  zoom={zoom}
                  className="w-full h-full object-contain"
                />

                {/* Vertical Divider Handle */}
                {renderedVectorImage && (
                  <div
                    onMouseDown={handleSplitMouseDown}
                    onTouchStart={handleSplitTouchStart}
                    className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 via-indigo-500 to-purple-500 cursor-ew-resize flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.7)] z-20 group"
                    style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950/95 text-white shadow-2xl border-2 border-indigo-400/90 text-xs font-bold ring-4 ring-black/60 group-hover:scale-110 group-hover:border-indigo-300 group-hover:shadow-indigo-500/50 active:scale-95 transition-all cursor-ew-resize backdrop-blur-md">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-indigo-300">
                        <polyline points="8 7 3 12 8 17" />
                        <polyline points="16 7 21 12 16 17" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Labels */}
                <span className="absolute top-3 left-3 rounded-md bg-neutral-950/80 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 border border-neutral-800">
                  {t('visualizer.raster')}
                </span>
                <span className="absolute top-3 right-3 rounded-md bg-indigo-950/90 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-700/50">
                  {t('visualizer.canvasVector')}
                </span>
              </div>
            )}

            {/* Raster Only Mode */}
            {originalImage && viewMode === 'raster' && (
              <div className="flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalImage.dataUrl}
                  alt={t('visualizer.originalRaster')}
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
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4174f7] via-[#9159fb] to-[#fccc4b] animate-pulse" />

            {/* Futuristic Glassmorphism Card */}
            <div className="relative flex flex-col items-center max-w-xs sm:max-w-sm mx-4 p-6 rounded-3xl border border-indigo-500/30 bg-neutral-950/90 shadow-2xl shadow-indigo-500/25 text-center backdrop-blur-md animate-in zoom-in-95 duration-150">
              {/* Outer pulsing ring glow */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute h-20 w-20 rounded-full border-2 border-dashed border-indigo-500/40 animate-[spin_6s_linear_infinite]" />
                <div className="absolute h-24 w-24 rounded-full border border-purple-500/30 animate-ping opacity-25" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#4174f7] via-[#9159fb] to-[#fccc4b] p-0.5 shadow-xl">
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
                <span>{t('visualizer.processingBadge')}</span>
              </div>

              <h4 className="text-sm font-bold text-white tracking-tight">
                {statusText || t('visualizer.processingDefault')}
              </h4>

              <p className="mt-1 text-[11px] text-neutral-400 max-w-xs leading-relaxed">
                {t('visualizer.processingDesc')}
              </p>

              {/* Progress shimmer track */}
              <div className="mt-3.5 w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[#4174f7] via-[#9159fb] to-[#fccc4b] rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Footer Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between border-t border-neutral-800 bg-neutral-950/90 px-4 py-2.5 text-xs text-neutral-400 gap-2 shrink-0">
        <div className="flex items-center gap-4">
          {renderedVectorImage ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                {t('visualizer.tracedIn', { ms: executionTimeMs })}
              </span>
              <span className="hidden sm:inline font-mono">
                {t('visualizer.pathsNodes')} <strong className="text-neutral-200">{nodeCount}</strong>
              </span>
              <span className="hidden md:inline font-mono">
                {t('visualizer.svgSize', { kb: (svgSizeBytes / 1024).toFixed(1) })}
              </span>
              {compressionRatio && (
                <span className="hidden lg:inline text-neutral-500">
                  {t('visualizer.ratio', { ratio: compressionRatio })}
                </span>
              )}
            </>
          ) : (
            <span>{t('visualizer.readyToTrace')}</span>
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
