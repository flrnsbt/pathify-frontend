'use client';

import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, Sparkles, AlertCircle, FileCheck, Eraser } from 'lucide-react';
import { computeImageHash } from '../lib/vtracer/compression';
import { useI18n } from '../lib/i18n';

export interface LoadedImageInfo {
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  imageData: ImageData;
  dataUrl: string;
  imageHash: string;
}

interface UploaderProps {
  onImageLoaded: (info: LoadedImageInfo) => void;
  currentImage: LoadedImageInfo | null;
  onClearImage?: () => void;
}

// Generate synthetic sample presets for immediate 1-click testing
export async function generateSampleImage(type: 'logo' | 'pixel' | 'badge'): Promise<LoadedImageInfo | null> {
  if (typeof window === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  if (type === 'logo') {
    canvas.width = 320;
    canvas.height = 320;
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 320, 320);

    // Flat mountain badge — straight edges + one circle, vectorizes cleanly
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 320, 320);

    // Sun
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(230, 90, 34, 0, Math.PI * 2);
    ctx.fill();

    // Back mountain
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(40, 260);
    ctx.lineTo(160, 120);
    ctx.lineTo(280, 260);
    ctx.closePath();
    ctx.fill();

    // Front mountain
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.moveTo(90, 260);
    ctx.lineTo(200, 170);
    ctx.lineTo(310, 260);
    ctx.closePath();
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
  const imageHash = await computeImageHash(imageData);

  return {
    fileName: `sample-${type}.png`,
    fileSize: Math.round(dataUrl.length * 0.75),
    width: canvas.width,
    height: canvas.height,
    imageData,
    dataUrl,
    imageHash,
  };
}

export function Uploader({ onImageLoaded, currentImage, onClearImage }: UploaderProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setError(t('uploader.invalidType'));
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
              setError(t('uploader.canvasError'));
              return;
            }
            ctx.clearRect(0, 0, width, height);
            // 1:1 draw at natural resolution — disable smoothing so no
            // resampling ever alters source pixels fed to the tracer
            ctx.imageSmoothingEnabled = false;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);

            computeImageHash(imageData).then((imageHash) => {
              onImageLoaded({
                fileName: file.name,
                fileSize: file.size,
                width: canvas.width,
                height: canvas.height,
                imageData,
                dataUrl,
                imageHash,
              });
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(t('uploader.pixelError', { msg }));
          }
        };
        img.onerror = () => {
          setError(t('uploader.loadError'));
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setError(t('uploader.readError'));
      };
      reader.readAsDataURL(file);
    },
    [onImageLoaded, t]
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

  const loadSample = async (type: 'logo' | 'pixel' | 'badge') => {
    setError(null);
    try {
      const sample = await generateSampleImage(type);
      if (sample) onImageLoaded(sample);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
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
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center justify-center gap-2 font-medium text-white text-sm">
                <span className="truncate max-w-[200px]">{currentImage.fileName}</span>
                <span className="text-xs text-neutral-400">
                  ({t('uploader.dimensions', { width: currentImage.width, height: currentImage.height })})
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                {t('uploader.replace')}
              </p>
            </div>
            {onClearImage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearImage();
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-800/60 px-2.5 py-1.5 text-xs text-neutral-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 transition"
                title={t('uploader.clearStudio')}
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>{t('uploader.clear')}</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-neutral-200">
              {t('uploader.dropPrefix')}
              <span className="text-indigo-400 hover:underline">{t('uploader.browse')}</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t('uploader.supports')}
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
          {t('uploader.trySample')}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => loadSample('logo')}
            className="rounded-md border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-700 hover:text-white transition"
          >
            {t('uploader.sampleLogo')}
          </button>
          <button
            type="button"
            onClick={() => loadSample('pixel')}
            className="rounded-md border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-700 hover:text-white transition"
          >
            {t('uploader.samplePixel')}
          </button>
          <button
            type="button"
            onClick={() => loadSample('badge')}
            className="rounded-md border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-700 hover:text-white transition"
          >
            {t('uploader.sampleBadge')}
          </button>
        </div>
      </div>
    </div>
  );
}
