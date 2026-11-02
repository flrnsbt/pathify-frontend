'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Uploader, LoadedImageInfo } from '../components/Uploader';
import { ControlsPanel } from '../components/ControlsPanel';
import { Visualizer } from '../components/Visualizer';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { CreditModal } from '../components/CreditModal';
import { AuthModal } from '../components/AuthModal';
import { UnlockModal } from '../components/UnlockModal';
import { useVTracer } from '../hooks/useVTracer';
import { useAuth } from '../lib/firebase/auth-context';
import {
  VTracerOptions,
  DEFAULT_VTRACER_OPTIONS,
} from '../lib/vtracer/types';
import { svgToWebpBitmap, autoCropImage } from '../lib/vtracer';
import {
  saveVectorizationHistory,
  fetchUserHistory,
  deleteHistoryItem,
  VectorizationHistoryItem,
  canAccessSvg,
  unlockSvgWithCredit,
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
  const [currentSvgId, setCurrentSvgId] = useState<string>('');
  const [previewWebpUrl, setPreviewWebpUrl] = useState<string | null>(null);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [creditReason, setCreditReason] = useState<string>('');
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

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

  // Check if current active SVG is unlocked
  const isCurrentUnlocked = Boolean(
    profile && canAccessSvg(profile, currentSvgId)
  );

  // Execute Vectorization
  const handleTrace = useCallback(
    async (imageToTrace?: LoadedImageInfo, optsToUse?: VTracerOptions) => {
      const img = imageToTrace || currentImage;
      const opts = optsToUse || options;
      if (!img) return;

      const generatedId = `svg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setCurrentSvgId(generatedId);

      try {
        const generatedSvg = await vectorize(img.imageData, opts);

        // Convert the generated SVG into a high-quality WebP bitmap
        // This renders high-fidelity visuals while keeping raw SVG hidden from DOM scrapers
        const webpUrl = await svgToWebpBitmap(generatedSvg, img.width, img.height);
        setPreviewWebpUrl(webpUrl);

        // Save to history (if user is authenticated)
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
    [currentImage, options, vectorize, user, loadHistory]
  );

  // Handle image load
  const handleImageLoaded = useCallback(
    (info: LoadedImageInfo) => {
      let finalInfo = info;
      if (options.cropToContent) {
        const cropRes = autoCropImage(info.imageData);
        if (cropRes && cropRes.hasCropped) {
          finalInfo = {
            ...info,
            imageData: cropRes.imageData,
            width: cropRes.width,
            height: cropRes.height,
            dataUrl: cropRes.dataUrl,
          };
        }
      }
      setCurrentImage(finalInfo);
      setPreviewWebpUrl(null);
      reset();
      if (autoTrace) {
        handleTrace(finalInfo, options);
      }
    },
    [autoTrace, options, reset, handleTrace]
  );

  // Handle Crop to Content (Auto-Trim margins on demand)
  const handleCropToContent = useCallback(() => {
    if (!currentImage) return;
    const cropResult = autoCropImage(currentImage.imageData);
    if (cropResult && cropResult.hasCropped) {
      const croppedInfo: LoadedImageInfo = {
        ...currentImage,
        imageData: cropResult.imageData,
        width: cropResult.width,
        height: cropResult.height,
        dataUrl: cropResult.dataUrl,
      };
      setCurrentImage(croppedInfo);
      setPreviewWebpUrl(null);
      handleTrace(croppedInfo, options);
    }
  }, [currentImage, options, handleTrace]);

  // Handle options change
  const handleOptionsChange = (newOptions: VTracerOptions) => {
    setOptions(newOptions);
    if (newOptions.cropToContent !== options.cropToContent && newOptions.cropToContent && currentImage) {
      const cropRes = autoCropImage(currentImage.imageData);
      if (cropRes && cropRes.hasCropped) {
        const croppedInfo: LoadedImageInfo = {
          ...currentImage,
          imageData: cropRes.imageData,
          width: cropRes.width,
          height: cropRes.height,
          dataUrl: cropRes.dataUrl,
        };
        setCurrentImage(croppedInfo);
        handleTrace(croppedInfo, newOptions);
        return;
      }
    }
    if (autoTrace && currentImage && !isProcessing) {
      handleTrace(currentImage, newOptions);
    }
  };

  // Direct file downloader helper
  const triggerSvgDownload = useCallback((svgContent: string, fileName: string) => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace(/\.[^/.]+$/, '') + '.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Handle Download Action with permission & credit checks
  const handleRequestDownload = useCallback(() => {
    if (!svg || !currentImage) return;

    // 1. If not logged in -> Ask to sign in with Google
    if (!user || user.isAnonymous) {
      setIsAuthOpen(true);
      return;
    }

    // 2. If Admin, Subscribed, or Already Unlocked -> Download immediately
    if (isCurrentUnlocked || profile?.isAdmin || profile?.subscription?.status === 'active') {
      triggerSvgDownload(svg, currentImage.fileName);
      return;
    }

    // 3. If User has available credits -> Open unlock confirmation modal
    if (profile && profile.credits > 0) {
      setIsUnlockOpen(true);
      return;
    }

    // 4. If No Credits -> Prompt to purchase via WalletConnect / Web3
    setCreditReason('You need at least 1 credit to unlock and download this SVG. Purchase credits with crypto below.');
    setIsCreditsOpen(true);
  }, [svg, currentImage, user, isCurrentUnlocked, profile, triggerSvgDownload]);

  // Handle Copy / View Code Action with permission checks
  const handleRequestCopyCode = useCallback(() => {
    if (!svg || !currentImage) return;

    if (!user || user.isAnonymous) {
      setIsAuthOpen(true);
      return;
    }

    if (isCurrentUnlocked || profile?.isAdmin || profile?.subscription?.status === 'active') {
      // Allowed: copy to clipboard
      navigator.clipboard.writeText(svg);
      return;
    }

    if (profile && profile.credits > 0) {
      setIsUnlockOpen(true);
      return;
    }

    setCreditReason('You need at least 1 credit to inspect and copy the raw SVG markup. Purchase credits with crypto below.');
    setIsCreditsOpen(true);
  }, [svg, currentImage, user, isCurrentUnlocked, profile]);

  // Confirm Unlock with 1 Credit
  const handleConfirmUnlock = async () => {
    if (!user || !currentSvgId) return;
    setIsUnlocking(true);
    try {
      const success = await unlockSvgWithCredit(user.uid, currentSvgId);
      if (success) {
        await refreshProfile();
        setIsUnlockOpen(false);
        if (svg && currentImage) {
          triggerSvgDownload(svg, currentImage.fileName);
        }
      }
    } catch (err) {
      console.error('Unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Load history item into viewer
  const handleSelectHistoryItem = async (item: VectorizationHistoryItem) => {
    setOptions({ ...DEFAULT_VTRACER_OPTIONS, ...item.parameters });
    setCurrentSvgId(item.id);
    const webpUrl = await svgToWebpBitmap(
      item.svg,
      item.originalDimensions.width || 300,
      item.originalDimensions.height || 300
    );
    setPreviewWebpUrl(webpUrl);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!user) return;
    await deleteHistoryItem(user.uid, id);
    setHistoryItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleRequestUnlockHistoryItem = (item: VectorizationHistoryItem) => {
    setCurrentSvgId(item.id);
    if (!user || user.isAnonymous) {
      setIsAuthOpen(true);
      return;
    }
    if (profile && profile.credits > 0) {
      setIsUnlockOpen(true);
    } else {
      setCreditReason('You need at least 1 credit to unlock this history item. Purchase credits with crypto below.');
      setIsCreditsOpen(true);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-neutral-950 text-neutral-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <div className="shrink-0">
        <Header
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenCredits={() => {
            setCreditReason('');
            setIsCreditsOpen(true);
          }}
          historyCount={historyItems.length}
        />
      </div>

      {/* Main Studio Workspace */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-6 flex flex-col lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:items-stretch lg:h-full lg:min-h-0">
          {/* Left Column: Upload & Parameters Panel (5 cols) - scrollable independently */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-8 custom-scrollbar">
            <Uploader
              onImageLoaded={handleImageLoaded}
              currentImage={currentImage}
            />

            <ControlsPanel
              options={options}
              onChange={handleOptionsChange}
              onTrace={() => handleTrace()}
              isProcessing={isProcessing}
              statusText={statusText}
              hasImage={Boolean(currentImage)}
              autoTrace={autoTrace}
              onToggleAutoTrace={setAutoTrace}
              onCropToContent={handleCropToContent}
            />
          </div>

          {/* Right Column: Interactive Visualizer & Canvas (7 cols) - fixed in viewport */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[500px] lg:min-h-0 lg:h-full lg:overflow-hidden">
            <Visualizer
              originalImage={currentImage}
              svg={svg}
              previewWebpUrl={previewWebpUrl}
              nodeCount={nodeCount}
              executionTimeMs={executionTimeMs}
              isUnlocked={isCurrentUnlocked}
              isProcessing={isProcessing}
              statusText={statusText}
              onRequestDownload={handleRequestDownload}
              onRequestCopyCode={handleRequestCopyCode}
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
        isAdmin={Boolean(profile?.isAdmin)}
        isSubscribed={Boolean(profile?.subscription?.status === 'active')}
        unlockedSvgIds={profile?.unlockedSvgIds || []}
        onRequestUnlock={handleRequestUnlockHistoryItem}
      />

      <CreditModal
        isOpen={isCreditsOpen}
        onClose={() => {
          setIsCreditsOpen(false);
          setCreditReason('');
        }}
        requiredReason={creditReason}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenCredits={() => {
          setIsAuthOpen(false);
          setCreditReason('');
          setIsCreditsOpen(true);
        }}
      />

      <UnlockModal
        isOpen={isUnlockOpen}
        onClose={() => setIsUnlockOpen(false)}
        onConfirm={handleConfirmUnlock}
        creditsAvailable={profile?.credits ?? 0}
        fileName={currentImage?.fileName || 'vector.svg'}
        isUnlocking={isUnlocking}
      />
    </div>
  );
}
