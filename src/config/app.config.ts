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
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "",
    handshakeUrl: "/api/handshake",
    refreshCreditsUrl: "/api/refresh-credits",
    supportUrl: "/api/support",
    createTransactionUrl: "/api/create-transaction",
    saveHistoryUrl: "/api/save-history",
  },

  // CORS allowed origins for serverless API routes
  allowedOrigins: [
    "https://vectorizerr.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as const;
