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

  // Testnet secret for debug mode (used to fetch testnet configurations and wallets)
  testnetSecret:
    process.env.TESTNET_SECRET,

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

  // API Endpoints: when BACKEND_URL is set (e.g., static Pages deploy), call backend directly;
  // otherwise use Next.js API proxy routes (Workers / local dev).
  api: {
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "",
    handshakeUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/handshake`,
    refreshCreditsUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/refresh-credits`,
    supportUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/support`,
    createTransactionUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/create-transaction`,
    saveHistoryUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/save-history`,
  },

  // CORS allowed origins for serverless API routes
  allowedOrigins: [
    "https://vectorizerr.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as const;
