'use client';

import  { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/Header';
import { Uploader, LoadedImageInfo } from '../components/Uploader';
import { ControlsPanel } from '../components/ControlsPanel';
import { Visualizer } from '../components/Visualizer';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { CreditModal } from '../components/CreditModal';
import { AuthModal } from '../components/AuthModal';
import { UnlockModal } from '../components/UnlockModal';
import { Footer } from '../components/Footer';
import { useVTracer } from '../hooks/useVTracer';
import { useAuth } from '../lib/firebase/auth-context';
import {
  VTracerOptions,
  DEFAULT_VTRACER_OPTIONS,
} from '../lib/vtracer/types';
import {
  svgToWebpBitmap,
  autoCropImage,
  computeImageHash,
} from '../lib/vtracer';
import {
  saveVectorizationHistory,
  fetchUserHistory,
  deleteHistoryItem,
  deleteAllHistoryItems,
  VectorizationHistoryItem,
  canAccessSvg,
  unlockImageWithCredit,
  getImageUnlockStatus,
  consumeImageGeneration,
  getUserProfile,
} from '../lib/firebase/firestore';
import { saveSourceImage, getSourceImage } from '../lib/local-source-images';

/** Content hash of an SVG string — the uniqueness key for a "generation". */
async function hashSvgContent(svgStr: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(svgStr)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
    loadResult,
  } = useVTracer();

  // State
  const [currentImage, setCurrentImage] = useState<LoadedImageInfo | null>(null);
  const [options, setOptions] = useState<VTracerOptions>({ ...DEFAULT_VTRACER_OPTIONS });
  const [autoTrace, setAutoTrace] = useState<boolean>(true);
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

  // Persist the source image locally (browser-only) so history items can be
  // re-edited later without storing raw image data in Firestore.
  useEffect(() => {
    if (currentImage?.imageHash && currentImage?.dataUrl) {
      saveSourceImage(currentImage.imageHash, currentImage.dataUrl);
    }
  }, [currentImage]);

  // Generations already counted this session (dedupe across repeated exports)
  const validatedGenerationsRef = useRef<Set<string>>(new Set());

  // Hash of the currently displayed SVG — identifies whether this exact
  // generation was already validated (paid), independent of remaining quota.
  const [currentSvgHash, setCurrentSvgHash] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    if (!svg) {
      setCurrentSvgHash('');
      return;
    }
    hashSvgContent(svg).then((h) => {
      if (!cancelled) setCurrentSvgHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [svg]);

  // True when the SVG on screen is already a validated (paid) generation —
  // re-exporting it is always free, even if the image quota is exhausted.
  const isCurrentGenerationOwned = Boolean(
    currentSvgHash &&
    (validatedGenerationsRef.current.has(currentSvgHash) ||
      historyItems.some((i) => i.generationId === currentSvgHash))
  );

  // A generation is "validated" when the user exports it (download SVG / copy SVG code).
  // Uniqueness is defined by SVG content: the first export of a given SVG consumes
  // 1 quota and writes the history entry; re-exports of identical SVG content are free.
  const recordValidatedGeneration = useCallback(async (): Promise<boolean> => {
    if (!user || user.isAnonymous || !currentImage || !svg) return false;
    try {
      // Dedupe key = hash of the SVG content itself. An already-validated
      // generation is always re-exportable, even with exhausted quota.
      const svgHash = await hashSvgContent(svg);
      const alreadyCounted =
        validatedGenerationsRef.current.has(svgHash) ||
        historyItems.some((i) => i.generationId === svgHash);
      if (alreadyCounted) return true;

      const freshProfile = await getUserProfile(user.uid);
      const isPaidPath = Boolean(
        freshProfile.subscription?.status === 'active' ||
        getImageUnlockStatus(freshProfile, currentImage.imageHash).isUnlocked
      );
      if (!isPaidPath) return false;

      // Fail closed: only proceed when the server confirms the quota consumption
      const remaining = await consumeImageGeneration(user.uid, currentImage.imageHash);
      if (remaining === null) return false;
      validatedGenerationsRef.current.add(svgHash);
      await refreshProfile();

      await saveVectorizationHistory(user.uid, {
        fileName: currentImage.fileName,
        originalDimensions: { width: currentImage.width, height: currentImage.height },
        originalSize: currentImage.fileSize,
        imageHash: currentImage.imageHash,
        nodeCount: (svg.match(/<path/g) || []).length,
        executionTimeMs: 0,
        parameters: options,
        svg,
        svgSize: new Blob([svg]).size,
        generationId: svgHash,
      });
      loadHistory();
      return true;
    } catch (err) {
      console.warn('Failed to record validated generation:', err);
      return false;
    }
  }, [user, currentImage, svg, historyItems, options, refreshProfile, loadHistory]);


  // Check if current active image and SVG are unlocked (1 credit = 10 generations on image hash)
  const unlockStatus = getImageUnlockStatus(profile, currentImage?.imageHash);
  const isCurrentUnlocked = Boolean(
    profile && (
      profile.subscription?.status === 'active' ||
      unlockStatus.isUnlocked ||
      canAccessSvg(profile, currentImage?.imageHash)
    )
  );

  // Execute Vectorization
  const handleTrace = useCallback(
    async (imageToTrace?: LoadedImageInfo, optsToUse?: VTracerOptions) => {
      const img = imageToTrace || currentImage;
      const opts = optsToUse || options;
      if (!img) return;

      try {
        const generatedSvg = await vectorize(img.imageData, opts);

        // Convert the generated SVG into a high-quality WebP bitmap
        // This renders high-fidelity visuals while keeping raw SVG hidden from DOM scrapers
        const webpUrl = await svgToWebpBitmap(generatedSvg, img.width, img.height);
        setPreviewWebpUrl(webpUrl);
      } catch (err) {
        console.error('Vectorization error:', err);
      }
    },
    [currentImage, options, vectorize]
  );

  // Handle image load
  const handleImageLoaded = useCallback(
    (info: LoadedImageInfo) => {
      setSourceNotice(null);
      const finalInfo = info;
      if (options.cropToContent) {
        const cropRes = autoCropImage(info.imageData);
        if (cropRes && cropRes.hasCropped) {
          computeImageHash(cropRes.imageData).then((newHash) => {
            const cropped = {
              ...info,
              imageData: cropRes.imageData,
              width: cropRes.width,
              height: cropRes.height,
              dataUrl: cropRes.dataUrl,
              imageHash: newHash,
            };
            setCurrentImage(cropped);
            setPreviewWebpUrl(null);
            reset();
            if (autoTrace) {
              handleTrace(cropped, options);
            }
          });
          return;
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
      computeImageHash(cropResult.imageData).then((newHash) => {
        const croppedInfo: LoadedImageInfo = {
          ...currentImage,
          imageData: cropResult.imageData,
          width: cropResult.width,
          height: cropResult.height,
          dataUrl: cropResult.dataUrl,
          imageHash: newHash,
        };
        setCurrentImage(croppedInfo);
        setPreviewWebpUrl(null);
        handleTrace(croppedInfo, options);
      });
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

  // When quota validation fails, route like a normal locked export:
  // credits available -> unlock dialog, otherwise -> top-up prompt.
  const routeAfterValidationFailure = useCallback(async () => {
    if (!user) return;
    const fresh = await getUserProfile(user.uid).catch(() => null);
    if (fresh && fresh.credits > 0) {
      setIsUnlockOpen(true);
    } else {
      setCreditReason('Could not verify your generation quota. Purchase credits to continue.');
      setIsCreditsOpen(true);
    }
  }, [user]);

  // Handle Download Action with permission & credit checks
  const handleRequestDownload = useCallback(async () => {
    if (!svg || !currentImage) return;

    // 1. If not logged in -> Ask to sign in with Google
    if (!user || user.isAnonymous) {
      setIsAuthOpen(true);
      return;
    }

    // 2. If Subscribed, Already Unlocked, or this generation was already
    //    validated -> validate then download
    if (isCurrentUnlocked || isCurrentGenerationOwned || profile?.subscription?.status === 'active') {
      const validated = await recordValidatedGeneration();
      if (!validated) {
        await routeAfterValidationFailure();
        return;
      }
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
  }, [svg, currentImage, user, isCurrentUnlocked, isCurrentGenerationOwned, profile, triggerSvgDownload, recordValidatedGeneration, routeAfterValidationFailure]);

  // Handle Copy / View Code Action with permission checks.
  // Returns true when the generation was validated and the caller may export it.
  const handleRequestCopyCode = useCallback(async (): Promise<boolean> => {
    if (!svg || !currentImage) return false;

    if (!user || user.isAnonymous) {
      setIsAuthOpen(true);
      return false;
    }

    if (isCurrentUnlocked || isCurrentGenerationOwned || profile?.subscription?.status === 'active') {
      const validated = await recordValidatedGeneration();
      if (!validated) {
        await routeAfterValidationFailure();
        return false;
      }
      return true;
    }

    if (profile && profile.credits > 0) {
      setIsUnlockOpen(true);
      return false;
    }

    setCreditReason('You need at least 1 credit to inspect and copy the raw SVG markup. Purchase credits with crypto below.');
    setIsCreditsOpen(true);
    return false;
  }, [svg, currentImage, user, isCurrentUnlocked, isCurrentGenerationOwned, profile, recordValidatedGeneration, routeAfterValidationFailure]);

  // Confirm Unlock with 1 Credit: grants 10 generations on currentImage.imageHash
  const handleConfirmUnlock = async () => {
    if (!user || !currentImage) return;
    setIsUnlocking(true);
    try {
      const success = await unlockImageWithCredit(user.uid, currentImage.imageHash);
      if (success) {
        await refreshProfile();
        setIsUnlockOpen(false);
        if (svg) {
          // This download is the first validated generation: consumes 1 quota + saves history.
          // Fail closed — no download when quota consumption can't be confirmed.
          const validated = await recordValidatedGeneration();
          if (validated) {
            triggerSvgDownload(svg, currentImage.fileName);
          } else {
            await routeAfterValidationFailure();
          }
        }
      }
    } catch (err) {
      console.error('Unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Notice shown when a history item's source image isn't in local storage
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);

  // Load history item into viewer: restores parameters + SVG, and the source
  // image from browser-local storage when available.
  const handleSelectHistoryItem = async (item: VectorizationHistoryItem) => {
    setOptions({ ...DEFAULT_VTRACER_OPTIONS, ...item.parameters });

    // Source image: browser-local store first, legacy embedded copy as fallback
    const sourceDataUrl =
      getSourceImage(item.imageHash) || item.originalBase64 || '';

    if (sourceDataUrl) {
      setSourceNotice(null);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = item.originalDimensions.width || img.width;
        canvas.height = item.originalDimensions.height || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setCurrentImage({
            fileName: item.fileName,
            fileSize: item.originalSize || 0,
            width: canvas.width,
            height: canvas.height,
            imageData,
            dataUrl: sourceDataUrl,
            imageHash: item.imageHash || `hash-${item.id}`,
          });
        }
      };
      img.src = sourceDataUrl;
    } else {
      // No local source — SVG preview still loads, but re-tracing requires
      // the user to upload the original file again.
      setCurrentImage(null);
      setSourceNotice(
        `The source image for "${item.fileName}" isn't stored in this browser. The SVG preview is restored, but you'll need to load the original file again to edit parameters and re-trace.`
      );
    }

    const webpUrl = await svgToWebpBitmap(
      item.svg,
      item.originalDimensions.width || 300,
      item.originalDimensions.height || 300
    );
    setPreviewWebpUrl(webpUrl);
    // Restore the SVG into viewer state so download/copy/code view use it
    loadResult(item.svg, item.nodeCount, item.executionTimeMs);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!user) return;
    await deleteHistoryItem(user.uid, id);
    setHistoryItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDeleteAllHistory = async () => {
    if (!user) return;
    await deleteAllHistoryItems(user.uid);
    setHistoryItems([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <div className="shrink-0 sticky top-0 z-40">
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

      {/* Main Studio Workspace - fills full viewport on desktop; scroll down to reveal footer */}
      <main className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-6 flex flex-col lg:h-[calc(100vh-4rem)] lg:min-h-[640px]">
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
            {sourceNotice && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                <span className="flex-1">{sourceNotice}</span>
                <button
                  type="button"
                  onClick={() => setSourceNotice(null)}
                  className="text-amber-300/70 hover:text-amber-100 transition"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}
            <Visualizer
              originalImage={currentImage}
              svg={svg}
              previewWebpUrl={previewWebpUrl}
              nodeCount={nodeCount}
              executionTimeMs={executionTimeMs}
              isUnlocked={isCurrentUnlocked || isCurrentGenerationOwned}
              generationsRemaining={unlockStatus.generationsRemaining}
              generationsMax={unlockStatus.maxGenerations}
              isProcessing={isProcessing}
              statusText={statusText}
              onRequestDownload={handleRequestDownload}
              onRequestCopyCode={handleRequestCopyCode}
            />
          </div>
        </div>
      </main>

      <Footer />

      {/* Modals & Drawers */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={historyItems}
        onSelect={handleSelectHistoryItem}
        onDelete={handleDeleteHistoryItem}
        onDeleteAll={handleDeleteAllHistory}
        isAdmin={Boolean(profile?.isAdmin)}
      />

      {isCreditsOpen && (
        <CreditModal
          isOpen={isCreditsOpen}
          onClose={() => {
            setIsCreditsOpen(false);
            setCreditReason('');
          }}
          requiredReason={creditReason}
          onOpenAuth={() => {
            setIsCreditsOpen(false);
            setCreditReason('');
            setIsAuthOpen(true);
          }}
        />
      )}

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
