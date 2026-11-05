/**
 * App-wide parameters fetched once from the backend (/api/app-config).
 * Unlike /api/config (crypto chains/wallets/prices — fetched lazily by the
 * payment flow), this endpoint serves non-crypto parameters needed across the
 * app, e.g. generation quotas.
 */

import { APP_CONFIG } from "@/config/app.config";
import { getAppCheckToken } from "./firebase/app-check";
import { buildApiHeaders } from "./api-headers";

export interface AppConfigResponse {
  limits?: {
    generationsPerUnlock?: number;
  };
}

let appConfigCache: AppConfigResponse | null = null;
let appConfigPromise: Promise<AppConfigResponse | null> | null = null;

export async function fetchAppConfig(): Promise<AppConfigResponse | null> {
  if (appConfigCache) return appConfigCache;
  if (!appConfigPromise) {
    appConfigPromise = (async () => {
      try {
        const appCheckToken = await getAppCheckToken();
        const res = await fetch(APP_CONFIG.api.appConfigUrl, {
          method: "GET",
          headers: buildApiHeaders({ appCheckToken }),
        });
        if (!res.ok) {
          console.warn("Failed to fetch app config:", res.status);
          return null;
        }
        const config = (await res.json()) as AppConfigResponse;
        appConfigCache = config;
        return config;
      } catch (err) {
        console.warn("Failed to fetch app config:", err);
        return null;
      } finally {
        appConfigPromise = null;
      }
    })();
  }
  return appConfigPromise;
}

/** Kick off the app-config fetch (idempotent, deduped). */
export function ensureAppConfig(): void {
  void fetchAppConfig();
}

/**
 * Generations granted per image unlock. Backend is the source of truth;
 * falls back to the historical default until the config has loaded.
 */
export function getGenerationsPerUnlock(): number {
  return appConfigCache?.limits?.generationsPerUnlock ?? 10;
}
