'use client';

import React from 'react';
import { X, Download, Check, Coins } from 'lucide-react';

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  creditsAvailable: number;
  fileName: string;
  isUnlocking: boolean;
}

export function UnlockModal({
  isOpen,
  onClose,
  onConfirm,
  creditsAvailable,
  fileName,
  isUnlocking,
}: UnlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="vectorizerr"
              className="h-8 w-8 rounded-lg border border-neutral-700/80 bg-neutral-950 p-0.5 object-contain"
            />
            <h3 className="text-sm font-semibold text-white">Unlock Vector SVG</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-4 space-y-3">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Unlock <strong className="text-white truncate block">{fileName}</strong> for vector downloads and editing.
          </p>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-amber-400" /> Cost:
            </span>
            <div className="text-right">
              <span className="font-semibold text-white">1 Credit</span>
              <span className="block text-[10px] text-emerald-400 font-medium">Includes 10 Generations</span>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-850 bg-neutral-950/60 p-3 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Your Credits:</span>
            <span className="font-semibold text-emerald-400">
              {creditsAvailable} credits
            </span>
          </div>

          <ul className="text-[11px] text-neutral-400 space-y-1.5 pl-1">
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span><strong>10 Generations</strong> on this image to fine-tune presets &amp; sliders</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Full resolution mathematical SVG file download</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Inspect &amp; copy raw SVG XML code</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span>Saved to your permanent cloud history</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-800 bg-neutral-800/80 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isUnlocking}
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {isUnlocking ? (
              <span>Unlocking...</span>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Unlock (1 Credit)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
