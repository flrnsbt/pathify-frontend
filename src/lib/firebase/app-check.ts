"use client";

import { FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
  CustomProvider,
  getToken,
  AppCheck,
} from "firebase/app-check";

let appCheckInstance: AppCheck | null = null;

/**
 * Initializes Firebase App Check to protect Auth, Firestore, and backend endpoints against abuse.
 * In production: Uses reCAPTCHA Enterprise or reCAPTCHA v3.
 * In development / testing: Uses Firebase App Check debug token.
 */
export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (appCheckInstance) {
    return appCheckInstance;
  }

  const isDev = process.env.NODE_ENV !== "production";
  const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;

  if (isDev) {
    // In dev/local testing, enable debug token so App Check passes without solving captchas
    // @ts-expect-error Firebase debug token setup on window/self
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === "true" || !debugToken ? true : debugToken;
  }

  const enterpriseKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY || "";
  const v3Key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  if (!enterpriseKey && !v3Key && !isDev) {
    console.info("[AppCheck] No reCAPTCHA key configured for production.");
    return null;
  }

  try {
    const provider = enterpriseKey
      ? new ReCaptchaEnterpriseProvider(enterpriseKey)
      : new ReCaptchaV3Provider(v3Key || "dummy-key-for-dev");

    appCheckInstance = initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    console.info("[AppCheck] Initialized successfully with auto-refresh enabled.");
  } catch (err) {
    console.warn("[AppCheck] Initialization notice:", err);
  }

  return appCheckInstance;
}

/**
 * Retrieves the current App Check token for outgoing API calls
 */
export async function getAppCheckToken(forceRefresh = false): Promise<string | null> {
  if (!appCheckInstance) {
    return null;
  }
  try {
    const res = await getToken(appCheckInstance, forceRefresh);
    return res.token;
  } catch (err) {
    console.warn("[AppCheck] Could not get token:", err);
    return null;
  }
}
