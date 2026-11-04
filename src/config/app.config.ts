/**
 * Application Configuration & Feature Flags
 * Centralized settings for vectorizerr frontend and API routes.
 */

export const APP_CONFIG = {
  name: "vectorizerr",
  displayName: "Vectorizerr",
  description:
    "High-performance vector graphics studio & lossless raster to SVG vectorizer",

  // Icon and assets
  iconUrl: "/icon.svg",

  // Feature Flags
  features: {
    /**
     * Free download formats: PNG and WebP can be downloaded client-side
     * without requiring user login or credit consumption.
     */
    enableFreeRasterDownload: true,
  },

  // API Endpoints: All API calls go through Cloudflare Functions (/api/...)
  // which inject secrets server-side and forward to the backend Worker.
  api: {
    configUrl: "/api/config",
    handshakeUrl: "/api/handshake",
    refreshCreditsUrl: "/api/refresh-credits",
    supportUrl: "/api/support",
    createTransactionUrl: "/api/create-transaction",
    saveHistoryUrl: "/api/save-history",
  },

  // CORS allowed origins
  allowedOrigins: [
    "https://vectorizerr.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as const;
