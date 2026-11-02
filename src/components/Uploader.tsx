'use client';

import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, Sparkles, AlertCircle, FileCheck } from 'lucide-react';

export interface LoadedImageInfo {
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  imageData: ImageData;
  dataUrl: string;
}

interface UploaderProps {
  onImageLoaded: (info: LoadedImageInfo) => void;
  currentImage: LoadedImageInfo | null;
}

export function Uploader({ onImageLoaded, currentImage }: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setError('Please upload a valid PNG, JPG, or WEBP image.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
              setError('Failed to create canvas 2D rendering context');
              return;
            }
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);

            onImageLoaded({
              fileName: file.name,
              fileSize: file.size,
              width: canvas.width,
              height: canvas.height,
              imageData,
              dataUrl,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(`Error processing image pixels: ${msg}`);
          }
        };
        img.onerror = () => {
          setError('Failed to load image file into browser image element');
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setError('Failed to read file from disk');
      };
      reader.readAsDataURL(file);
    },
    [onImageLoaded]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Generate synthetic sample presets for immediate 1-click testing
  const loadSample = (type: 'logo' | 'pixel' | 'badge') => {
    setError(null);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (type === 'logo') {
      canvas.width = 320;
      canvas.height = 320;
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 320, 320);

      // Gradient rounded diamond
      const grad = ctx.createLinearGradient(60, 60, 260, 260);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#ec4899');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(60, 60, 200, 200, [40]);
      ctx.fill();

      // Inner white star / polygon
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(160, 160, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(160, 160, 25, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'pixel') {
      // 32x32 pixel art character scaled to 128x128
      canvas.width = 128;
      canvas.height = 128;
      ctx.imageSmoothingEnabled = false;

      // Draw pixel art character
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 128, 128);

      const pSize = 8;
      const drawPix = (x: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * pSize, y * pSize, pSize, pSize);
      };

      // Heart / Sword pixel art
      const heartCoords = [
        [4, 4], [5, 4], [7, 4], [8, 4],
        [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5],
        [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6],
        [4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
        [5, 8], [6, 8], [7, 8],
        [6, 9],
      ];
      for (const [x, y] of heartCoords) {
        drawPix(x + 1, y + 1, '#ef4444');
      }
    } else {
      // Emblem Badge
      canvas.width = 280;
      canvas.height = 280;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 280, 280);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(140, 140, 100, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(140, 80);
      ctx.lineTo(190, 180);
      ctx.lineTo(90, 180);
      ctx.closePath();
      ctx.fill();
    }

    const dataUrl = canvas.toDataURL('image/png');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    onImageLoaded({
      fileName: `sample-${type}.png`,
      fileSize: Math.round(dataUrl.length * 0.75),
      width: canvas.width,
      height: canvas.height,
      imageData,
      dataUrl,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drag & Drop Card */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : currentImage
            ? 'border-neutral-700 bg-neutral-900/40 hover:border-neutral-600'
            : 'border-neutral-800 bg-neutral-900/20 hover:border-indigo-500/50 hover:bg-neutral-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800/80 text-indigo-400 mb-3 shadow-inner">
          {currentImage ? (
            <FileCheck className="h-6 w-6 text-emerald-400" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>

        {currentImage ? (
          <div>
            <div className="flex items-center justify-center gap-2 font-medium text-white text-sm">
              <span className="truncate max-w-[200px]">{currentImage.fileName}</span>
              <span className="text-xs text-neutral-400">
                ({currentImage.width} × {currentImage.height} px)
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Click or drag another file to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-neutral-200">
              Drop your raster image here, or{' '}
              <span className="text-indigo-400 hover:underline">browse</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Supports PNG, JPG, and WEBP (auto-converts to RGBA array)
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sample presets for immediate test */}
      <div className="flex items-center justify-between rounded-xl border border-neutral-850 bg-neutral-900/40 p-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          Try sample:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => loadSample('logo')}
            className="rounded-md border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-700 hover:text-white transition"
          >
            Geometric Logo
          </button>
          <button
            type="button"
            onClick={() => loadSample('pixel')}
            className="rounded-md border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-700 hover:text-white transition"
          >
            Pixel Art
          </button>
          <button
            type="button"
            onClick={() => loadSample('badge')}
            className="rounded-md border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-700 hover:text-white transition"
          >
            Emblem Badge
          </button>
        </div>
      </div>
    </div>
  );
}
