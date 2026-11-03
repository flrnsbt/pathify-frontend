'use client';

import { FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
  CustomProvider,
  getToken,
  AppCheck,
} from 'firebase/app-check';

let appCheckInstance: AppCheck | null = null;

/**
 * Initializes Firebase App Check to protect Auth, Firestore, and backend endpoints against abuse.
 * In production: Uses reCAPTCHA Enterprise or reCAPTCHA v3.
 * In development / testing: Uses Firebase App Check debug token.
 */
export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (appCheckInstance) {
    return appCheckInstance;
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;

  // In development, enable App Check debug token
  if (isDev || debugToken) {
    // @ts-expect-error Firebase debug token setup on window/self
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
  }

  const siteKey =
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY ||
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    // Fallback in local development without reCAPTCHA keys configured yet
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: async () => ({
            token: 'vectorizerr-dev-debug-token',
            expireTimeMillis: Date.now() + 3600000,
          }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
      console.info('[AppCheck] Initialized in local development mode.');
    } catch {
      // Ignored if already initialized or in test environment
    }
    return appCheckInstance;
  }

  try {
    const isEnterprise = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY);
    const provider = isEnterprise
      ? new ReCaptchaEnterpriseProvider(siteKey)
      : new ReCaptchaV3Provider(siteKey);

    appCheckInstance = initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    console.info('[AppCheck] Initialized with reCAPTCHA provider.');
  } catch (err) {
    console.warn('[AppCheck] Initialization warning:', err);
  }

  return appCheckInstance;
}

/**
 * Retrieves the current App Check token for outgoing API calls
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) {
    return null;
  }
  try {
    const res = await getToken(appCheckInstance, false);
    return res.token;
  } catch (err) {
    console.warn('[AppCheck] Could not get token:', err);
    return null;
  }
}
