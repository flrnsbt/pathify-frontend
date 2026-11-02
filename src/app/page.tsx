'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Uploader, LoadedImageInfo } from '../components/Uploader';
import { ControlsPanel } from '../components/ControlsPanel';
import { Visualizer } from '../components/Visualizer';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { CreditModal } from '../components/CreditModal';
import { AuthModal } from '../components/AuthModal';
import { PerformanceAuditModal } from '../components/PerformanceAuditModal';
import { useVTracer } from '../hooks/useVTracer';
import { useAuth } from '../lib/firebase/auth-context';
import {
  VTracerOptions,
  DEFAULT_VTRACER_OPTIONS,
} from '../lib/vtracer/types';
import {
  saveVectorizationHistory,
  fetchUserHistory,
  deleteHistoryItem,
  VectorizationHistoryItem,
  updateUserCredits,
} from '../lib/firebase/firestore';

export default function Home() {
  const { user, profile, refreshProfile } = useAuth();
  const {
    vectorize,
    svg,
    nodeCount,
    executionTimeMs,
    isProcessing,
    statusText,
    reset,
  } = useVTracer();

  // State
  const [currentImage, setCurrentImage] = useState<LoadedImageInfo | null>(null);
  const [options, setOptions] = useState<VTracerOptions>({ ...DEFAULT_VTRACER_OPTIONS });
  const [autoTrace, setAutoTrace] = useState<boolean>(true);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  // History list
  const [historyItems, setHistoryItems] = useState<VectorizationHistoryItem[]>([]);

  // Load history when user changes
  useEffect(() => {
    let active = true;
    if (user?.uid) {
      fetchUserHistory(user.uid).then((items) => {
        if (active) {
          setHistoryItems(items);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  const loadHistory = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const items = await fetchUserHistory(user.uid);
      setHistoryItems(items);
    } catch (err) {
      console.warn('Could not load history:', err);
    }
  }, [user]);

  // Execute Vectorization
  const handleTrace = useCallback(
    async (imageToTrace?: LoadedImageInfo, optsToUse?: VTracerOptions) => {
      const img = imageToTrace || currentImage;
      const opts = optsToUse || options;
      if (!img) return;

      try {
        const generatedSvg = await vectorize(img.imageData, opts);

        // Deduct 1 credit if not pro
        if (user && profile && !profile.isPro && profile.credits > 0) {
          updateUserCredits(user.uid, profile.credits - 1).then(refreshProfile);
        }

        // Save to Firestore history
        if (user && generatedSvg) {
          await saveVectorizationHistory(user.uid, {
            fileName: img.fileName,
            originalDimensions: { width: img.width, height: img.height },
            originalSize: img.fileSize,
            nodeCount: (generatedSvg.match(/<path/g) || []).length,
            executionTimeMs: 0,
            parameters: opts,
            svg: generatedSvg,
            svgSize: new Blob([generatedSvg]).size,
          });
          loadHistory();
        }
      } catch (err) {
        console.error('Vectorization error:', err);
      }
    },
    [currentImage, options, vectorize, user, profile, refreshProfile, loadHistory]
  );

  // Handle image load
  const handleImageLoaded = useCallback(
    (info: LoadedImageInfo) => {
      setCurrentImage(info);
      reset();
      if (autoTrace) {
        handleTrace(info, options);
      }
    },
    [autoTrace, options, reset, handleTrace]
  );

  // Handle options change
  const handleOptionsChange = (newOptions: VTracerOptions) => {
    setOptions(newOptions);
    if (autoTrace && currentImage && !isProcessing) {
      handleTrace(currentImage, newOptions);
    }
  };

  // Load history item into viewer
  const handleSelectHistoryItem = (item: VectorizationHistoryItem) => {
    setOptions({ ...DEFAULT_VTRACER_OPTIONS, ...item.parameters });
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!user) return;
    await deleteHistoryItem(user.uid, id);
    setHistoryItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCredits={() => setIsCreditsOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        historyCount={historyItems.length}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Upload & Parameters Panel (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
            {/* Image Uploader */}
            <Uploader
              onImageLoaded={handleImageLoaded}
              currentImage={currentImage}
            />

            {/* Trace Controls Panel */}
            <ControlsPanel
              options={options}
              onChange={handleOptionsChange}
              onTrace={() => handleTrace()}
              isProcessing={isProcessing}
              statusText={statusText}
              hasImage={Boolean(currentImage)}
              autoTrace={autoTrace}
              onToggleAutoTrace={setAutoTrace}
            />
          </div>

          {/* Right Column: Interactive Visualizer & Canvas (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[640px]">
            <Visualizer
              originalImage={currentImage}
              svg={svg}
              nodeCount={nodeCount}
              executionTimeMs={executionTimeMs}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </main>

      {/* Modals & Drawers */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={historyItems}
        onSelect={handleSelectHistoryItem}
        onDelete={handleDeleteHistoryItem}
      />

      <CreditModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <PerformanceAuditModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />
    </div>
  );
}
