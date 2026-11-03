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
  const debugToken =
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN || "";

  if (isDev && debugToken) {
    // @ts-expect-error Firebase debug token setup on window/self
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY || "";

  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.info("[AppCheck] Initialized with reCAPTCHA provider.");
  } catch (err) {
    console.warn("[AppCheck] Initialization warning:", err);
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
    console.warn("[AppCheck] Could not get token:", err);
    return null;
  }
}
