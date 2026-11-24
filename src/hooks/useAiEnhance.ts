'use client';

import { useState } from 'react';

const AI_ENHANCE_PREF_KEY = 'vtracer_ai_enhance_pref';
type AiEnhancePref = 'on' | 'off';

function getAiEnhancePref(): AiEnhancePref | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(AI_ENHANCE_PREF_KEY);
  return v === 'on' || v === 'off' ? v : null;
}

function setAiEnhancePref(pref: AiEnhancePref): void {
  try {
    localStorage.setItem(AI_ENHANCE_PREF_KEY, pref);
  } catch {
    // ignore
  }
}

// Separate flag: user dismissed the "AI Enhance recommended" suggestion, so we
// stop proposing it for images where detection says it would help.
const AI_ENHANCE_SUGGEST_DISMISS_KEY = 'vtracer_ai_enhance_suggest_dismissed';

function isAiEnhanceSuggestDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AI_ENHANCE_SUGGEST_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissAiEnhanceSuggest(): void {
  try {
    localStorage.setItem(AI_ENHANCE_SUGGEST_DISMISS_KEY, '1');
  } catch {
    // ignore
  }
}

export type { AiEnhancePref };

export function useAiEnhance(): {
  enhanceProgress: number | null;
  setEnhanceProgress: (p: number | null) => void;
  showEnhancePrompt: boolean;
  setShowEnhancePrompt: (v: boolean) => void;
  enhancePromptVariant: 'offer' | 'suggest';
  setEnhancePromptVariant: (v: 'offer' | 'suggest') => void;
  enhancePromptDontAsk: boolean;
  setEnhancePromptDontAsk: (v: boolean) => void;
  getAiEnhancePref: () => AiEnhancePref | null;
  setAiEnhancePref: (p: AiEnhancePref) => void;
  isAiEnhanceSuggestDismissed: () => boolean;
  dismissAiEnhanceSuggest: () => void;
} {
  const [enhanceProgress, setEnhanceProgress] = useState<number | null>(null);
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false);
  // 'offer' = enhance looks unnecessary, offer to enable anyway;
  // 'suggest' = enhance looks worthwhile but the user disabled it — propose enabling.
  const [enhancePromptVariant, setEnhancePromptVariant] = useState<'offer' | 'suggest'>('offer');
  const [enhancePromptDontAsk, setEnhancePromptDontAsk] = useState(false);

  return {
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
  };
}
