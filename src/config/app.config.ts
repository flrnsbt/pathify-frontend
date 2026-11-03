/**
 * Application Configuration & Feature Flags
 * Centralized settings for vectorizerr frontend and API routes.
 */

export const APP_CONFIG = {
  name: "vectorizerr",
  displayName: "Vectorizerr",
  description:
    "High-performance vector graphics studio & lossless raster to SVG vectorizer",
  // Base public deployment URL
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://vectorizerr.pages.dev",

  // Icon and assets
  iconUrl: "/icon.svg",

  // Feature Flags
  features: {
    /**
     * Flag to enable or disable the Admin Pass mode.
     * When false, admin pass privileges and overrides are completely disabled across the application.
     * Can be configured via NEXT_PUBLIC_ENABLE_ADMIN_PASS env variable (default: false).
     */
    enableAdminPass: process.env.NEXT_PUBLIC_ENABLE_ADMIN_PASS === "true",

    /**
     * Free download formats: PNG and WebP can be downloaded client-side
     * without requiring user login or credit consumption.
     */
    enableFreeRasterDownload: true,

    /**
     * Debug mode flag (enables testnets and development tools)
     */
    debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === "true",
  },

  // API Endpoints (Handled or proxied server-side so no secrets leak to DevTools)
  api: {
    backendUrl:
      process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.vectorizerr.workers.dev",
    handshakeUrl: "/api/handshake",
    refreshCreditsUrl: "/api/refresh-credits",
    supportUrl: "/api/support",
  },

  // CORS allowed origins for serverless API routes
  allowedOrigins: [
    "https://vectorizerr.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as const;

/**
 * Checks whether Admin Pass mode is currently active and allowed by configuration.
 */
export function isAdminPassEnabled(): boolean {
  return APP_CONFIG.features.enableAdminPass;
}

/**
 * Toggles or sets the client-side Admin Pass override flag in localStorage.
 * Only takes effect if APP_CONFIG.features.enableAdminPass is true.
 */
export function setLocalAdminPassOverride(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled && APP_CONFIG.features.enableAdminPass) {
      localStorage.setItem("vtracer_admin_override", "true");
    } else {
      localStorage.removeItem("vtracer_admin_override");
    }
  } catch {}
}

/**
 * Checks if local admin pass override is set in client storage.
 */
export function isLocalAdminPassActive(): boolean {
  if (typeof window === "undefined") return false;
  if (!APP_CONFIG.features.enableAdminPass) return false;
  try {
    return localStorage.getItem("vtracer_admin_override") === "true";
  } catch {
    return false;
  }
}
