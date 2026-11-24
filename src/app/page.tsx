'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/Header';
import { Uploader, LoadedImageInfo, generateSampleImage } from '../components/Uploader';
import { ControlsPanel } from '../components/ControlsPanel';
import { Visualizer } from '../components/Visualizer';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { CreditModal } from '../components/CreditModal';
import { AuthModal } from '../components/AuthModal';
import { UnlockModal } from '../components/UnlockModal';
import { Footer } from '../components/Footer';
import { useVTracer } from '../hooks/useVTracer';
import { useAuth } from '../lib/firebase/auth-context';
import { useAiEnhance } from '../hooks/useAiEnhance';
import { useHistoryManager } from '../hooks/useHistoryManager';
import {
  VTracerOptions,
  DEFAULT_VTRACER_OPTIONS,
  PRESET_OPTIONS,
  PresetOption,
} from '../lib/vtracer/types';
import { detectPreset, isEnhancementWorthwhile } from '../lib/vtracer/detect';
import {
  svgToWebpBitmap,
  autoCropImage,
  computeImageHash,
} from '../lib/vtracer';
import {
  canAccessSvg,
  unlockImageWithCredit,
  getImageUnlockStatus,
  getUserProfile,
} from '../lib/firebase/firestore';
import { saveSourceImage, getSourceImage } from '../lib/local-source-images';
import { upscaleImageData, isEnhancementCached, UpscaleModelId } from '../lib/upscale';
import { useI18n } from '../lib/i18n';
import { HistoryGeneration } from '../lib/firebase/firestore';

export default function Home() {
  const { t } = useI18n();
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
  const [paramsLocked, setParamsLocked] = useState(false);
  const [previewWebpUrl, setPreviewWebpUrl] = useState<string | null>(null);
  // Notice shown for source-image/history caveats (missing local source,
  // oversized SVG saved locally only, etc.)
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [isRestoringHistory, setIsRestoringHistory] = useState(false);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [creditReason, setCreditReason] = useState<string>('');
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // AI Enhance hook
  const {
    enhanceProgress,
    setEnhanceProgress,
    showEnhancePrompt,
    setShowEnhancePrompt,
    enhancePromptVariant,
    setEnhancePromptVariant,
    enhancePromptDontAsk,
    setEnhancePromptDontAsk,
    getAiEnhancePref,
    setAiEnhancePref,
    isAiEnhanceSuggestDismissed,
    dismissAiEnhanceSuggest,
  } = useAiEnhance();

  // History manager hook
  const {
    loadHistory,
    loadMoreHistory,
    refreshLocalImages,
    handleDeleteHistoryEntry,
    handleDeleteHistoryGeneration,
    handleDeleteAllHistory,
    displayEntries,
    displayTotal,
    historyHasMore,
    historyLoadingMore,
    isCurrentGenerationOwned,
    recordValidatedGeneration,
  } = useHistoryManager(currentImage, svg, options, refreshProfile, setSourceNotice);

  // Persist the source image locally (browser-only) so history items can be
  // re-edited later without storing raw image data in Firestore.
  useEffect(() => {
    if (currentImage?.imageHash && currentImage?.dataUrl) {
      saveSourceImage(currentImage.imageHash, currentImage.dataUrl);
    }
  }, [currentImage]);

  // Check if current active image and SVG are unlocked (1 credit = 10 generations on image hash)
  const unlockStatus = getImageUnlockStatus(profile, currentImage?.imageHash);
  const isCurrentUnlocked = Boolean(
    profile && (
      profile.subscription?.status === 'active' ||
      unlockStatus.isUnlocked ||
      canAccessSvg(profile, currentImage?.imageHash)
    )
  );

  // Monotonic trace id + abort handle: a new trace (e.g. user toggled AI
  // Enhance or changed params mid-enhance) cancels the previous one's
  // in-flight work and makes its continuations no-ops.
  const traceSeqRef = useRef(0);
  const enhanceAbortRef = useRef<AbortController | null>(null);

  // Execute Vectorization
  const handleTrace = useCallback(
    async (imageToTrace?: LoadedImageInfo, optsToUse?: VTracerOptions) => {
      const traceId = ++traceSeqRef.current;
      const isCurrent = () => traceId === traceSeqRef.current;

      enhanceAbortRef.current?.abort();
      const enhanceController = new AbortController();
      enhanceAbortRef.current = enhanceController;

      const img = imageToTrace || currentImage;
      const opts = optsToUse || options;
      if (!img) return;

      // A non-enhancing trace must not inherit the frozen progress indicator
      // left behind by the cancelled enhancement.
      if (!opts.aiEnhance) setEnhanceProgress(null);

      try {
        let traceImage = img.imageData;
        let traceW = img.width;
        let traceH = img.height;

        if (opts.aiEnhance) {
          const modelId = (opts.aiEnhanceModel ?? 'anime') as UpscaleModelId;
          if (!isEnhancementCached(img.imageData, modelId)) {
            setEnhanceProgress(0);
          }
          const enhanced = await upscaleImageData(
            img.imageData,
            modelId,
            setEnhanceProgress,
            enhanceController.signal
          );
          if (!isCurrent()) return;
          traceImage = enhanced;
          traceW = enhanced.width;
          traceH = enhanced.height;
        }

        const generatedSvg = await vectorize(traceImage, opts);
        if (!isCurrent()) return;

        // Convert the generated SVG into a high-quality WebP bitmap
        // This renders high-fidelity visuals while keeping raw SVG hidden from DOM scrapers
        const webpUrl = await svgToWebpBitmap(generatedSvg, traceW, traceH);
        if (!isCurrent()) return;
        setPreviewWebpUrl(webpUrl);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // superseded by newer trace
        console.error('Vectorization error:', err);
      } finally {
        if (isCurrent()) setEnhanceProgress(null);
      }
    },
    [currentImage, options, vectorize]
  );

  // Reset the whole studio: cancels any in-flight trace/enhancement, drops the
  // source image, clears the generated result and restores default options.
  const handleClearStudio = useCallback(() => {
    traceSeqRef.current += 1;
    enhanceAbortRef.current?.abort();
    enhanceAbortRef.current = null;
    reset();
    setCurrentImage(null);
    setPreviewWebpUrl(null);
    setOptions({ ...DEFAULT_VTRACER_OPTIONS });
    setParamsLocked(false);
    setSourceNotice(null);
    setEnhanceProgress(null);
    setIsRestoringHistory(false);
  }, [reset]);

  // Handle image load
  const handleImageLoaded = useCallback(
    (info: LoadedImageInfo) => {
      setSourceNotice(null);
      setParamsLocked(false);
      // Auto-detect the best preset + enhance model for this source image.
      // AI Enhance defaults on only when it is likely to matter (detailed /
      // noisy sources); a stored user preference always wins.
      const detected = detectPreset(info.imageData);
      const pref = getAiEnhancePref();
      const worthwhile = isEnhancementWorthwhile(info.imageData);
      const aiEnhance = pref !== null ? pref === 'on' : worthwhile;
      const detectedOptions: VTracerOptions = {
        ...options,
        ...PRESET_OPTIONS[detected.preset as Exclude<PresetOption, 'custom'>],
        preset: detected.preset,
        aiEnhance,
        // Demo samples carry hand-tuned params that beat auto-detection.
        ...(info.vectorizeOptions ?? {}),
      };
      setOptions(detectedOptions);
      if (pref === null && !worthwhile) {
        setEnhancePromptVariant('offer');
        setEnhancePromptDontAsk(false);
        setShowEnhancePrompt(true);
      } else if (
        pref === 'off' &&
        worthwhile &&
        !isAiEnhanceSuggestDismissed()
      ) {
        // User explicitly disabled AI Enhance, but detection says it would
        // help — propose enabling it once (dismissible forever via checkbox).
        setEnhancePromptVariant('suggest');
        setEnhancePromptDontAsk(false);
        setShowEnhancePrompt(true);
      }
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
              handleTrace(cropped, detectedOptions);
            }
          });
          return;
        }
      }
      setCurrentImage(finalInfo);
      setPreviewWebpUrl(null);
      reset();
      if (autoTrace) {
        handleTrace(finalInfo, detectedOptions);
      }
    },
    [autoTrace, options, reset, handleTrace, getAiEnhancePref, isAiEnhanceSuggestDismissed, setEnhancePromptVariant, setEnhancePromptDontAsk, setShowEnhancePrompt]
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
    // A manual AI Enhance toggle is a user preference — persist it so image
    // auto-detection never overrides an explicit on/off choice.
    if (newOptions.aiEnhance !== options.aiEnhance) {
      setAiEnhancePref(newOptions.aiEnhance ? 'on' : 'off');
    }
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
      setCreditReason(t('page.quotaVerifyFailed'));
      setIsCreditsOpen(true);
    }
  }, [user, t]);

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
    setCreditReason(t('page.needCreditsDownload'));
    setIsCreditsOpen(true);
  }, [svg, currentImage, user, isCurrentUnlocked, isCurrentGenerationOwned, profile, triggerSvgDownload, recordValidatedGeneration, routeAfterValidationFailure, t]);

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

    setCreditReason(t('page.needCreditsCopy'));
    setIsCreditsOpen(true);
    return false;
  }, [svg, currentImage, user, isCurrentUnlocked, isCurrentGenerationOwned, profile, recordValidatedGeneration, routeAfterValidationFailure, t]);

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

  // Load history item into viewer: restores parameters + SVG, and the source
  // image from browser-local storage when available.
  const handleSelectHistoryItem = async (item: HistoryGeneration) => {
    setIsRestoringHistory(true);
    try {
      setOptions({ ...DEFAULT_VTRACER_OPTIONS, ...item.parameters });

      // Source image: browser-local store keyed by imageHash
      const sourceDataUrl = getSourceImage(item.imageHash) || '';

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
        setParamsLocked(true);
        setSourceNotice(t('page.sourceImageMissing', { fileName: item.fileName }));
      }

      const webpUrl = await svgToWebpBitmap(
        item.svg,
        item.originalDimensions.width || 300,
        item.originalDimensions.height || 300
      );
      setPreviewWebpUrl(webpUrl);
      // Restore the SVG into viewer state so download/copy/code view use it
      loadResult(item.svg, item.nodeCount, item.executionTimeMs);
    } catch (err) {
      console.error('Failed to restore history item:', err);
    } finally {
      setIsRestoringHistory(false);
    }
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
          historyCount={displayTotal}
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
              onClearImage={handleClearStudio}
            />

            <ControlsPanel
              options={options}
              onChange={handleOptionsChange}
              onTrace={() => handleTrace()}
              isProcessing={isProcessing || enhanceProgress !== null || isRestoringHistory}
              statusText={
                enhanceProgress !== null
                  ? t('page.aiEnhancing', { percent: Math.round(enhanceProgress * 100) })
                  : isRestoringHistory
                    ? t('status.loadingGeneration')
                    : statusText
              }
              hasImage={Boolean(currentImage)}
              autoTrace={autoTrace}
              onToggleAutoTrace={setAutoTrace}
              onCropToContent={handleCropToContent}
              generationsRemaining={
                unlockStatus.isUnlocked ? unlockStatus.generationsRemaining : undefined
              }
              generationsMax={unlockStatus.maxGenerations}
              locked={paramsLocked}
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
                  aria-label={t('common.dismiss')}
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
              generationsRemaining={
                unlockStatus.isUnlocked ? unlockStatus.generationsRemaining : undefined
              }
              generationsMax={unlockStatus.maxGenerations}
              isProcessing={isProcessing || enhanceProgress !== null || isRestoringHistory}
              statusText={
                enhanceProgress !== null
                  ? t('page.aiEnhancing', { percent: Math.round(enhanceProgress * 100) })
                  : isRestoringHistory
                    ? t('status.loadingGeneration')
                    : statusText
              }
              onRequestDownload={handleRequestDownload}
              onRequestCopyCode={handleRequestCopyCode}
              onLoadSample={async (type) => {
                const sample = await generateSampleImage(type);
                if (sample) handleImageLoaded(sample);
              }}
            />
          </div>
        </div>
      </main>

      <Footer />

      {/* Modals & Drawers */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        userId={user?.uid}
        entries={displayEntries}
        totalCount={displayTotal}
        hasMore={historyHasMore}
        isLoadingMore={historyLoadingMore}
        onLoadMore={loadMoreHistory}
        onSelect={handleSelectHistoryItem}
        onDeleteEntry={handleDeleteHistoryEntry}
        onDeleteGeneration={handleDeleteHistoryGeneration}
        onDeleteAll={handleDeleteAllHistory}
        isAdmin={Boolean(profile?.isAdmin)}
        profile={profile}
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

      {/* AI Enhance prompt — 'offer' when the source doesn't need it,
          'suggest' when detection says it would help but the user disabled it */}
      {showEnhancePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">
              {enhancePromptVariant === 'suggest'
                ? t('page.enhanceRecommended')
                : t('page.enableEnhance')}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              {enhancePromptVariant === 'suggest'
                ? t('page.enhanceRecommendedBody')
                : t('page.enableEnhanceBody')}
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={enhancePromptDontAsk}
                onChange={(e) => setEnhancePromptDontAsk(e.target.checked)}
                className="accent-violet-500 h-3.5 w-3.5 rounded"
              />
              {t('page.dontAskAgain')}
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = { ...options, aiEnhance: true };
                  setOptions(next);
                  if (currentImage) handleTrace(currentImage, next);
                  setAiEnhancePref('on');
                  setShowEnhancePrompt(false);
                }}
                className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition"
              >
                {t('page.enable')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (enhancePromptVariant === 'suggest') {
                    if (enhancePromptDontAsk) dismissAiEnhanceSuggest();
                  } else if (enhancePromptDontAsk) {
                    setAiEnhancePref('off');
                  }
                  setShowEnhancePrompt(false);
                }}
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:border-neutral-700 transition"
              >
                {enhancePromptVariant === 'suggest' ? t('page.keepOff') : t('page.noThanks')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
