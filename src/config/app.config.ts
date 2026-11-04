/**
 * Application Configuration & Feature Flags
 * Centralized settings for vectorizerr frontend and API routes.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export const APP_CONFIG = {
  name: "vectorizerr",
  displayName: "Vectorizerr",
  description:
    "High-performance vector graphics studio & lossless raster to SVG vectorizer",
  // Base public deployment URL
  appUrl: APP_URL,

  // Icon and assets
  iconUrl: "/icon.svg",

  // Testnet secret for localhost development only (not exposed in production builds)
  testnetSecret: process.env.TESTNET_SECRET,

  // Feature Flags
  features: {
    /**
     * Free download formats: PNG and WebP can be downloaded client-side
     * without requiring user login or credit consumption.
     */
    enableFreeRasterDownload: true,
  },

  // API Endpoints: Defaults to Next.js API proxy routes (/api/...) which inject
  // private server-side secrets (API_SECRET) and forward requests to the Cloudflare Worker backend.
  // Can be overridden with environment variables if an explicit direct URL is needed.
  api: {
    backendUrl: process.env.BACKEND_URL || "",
    configUrl: process.env.NEXT_PUBLIC_CONFIG_API_URL || `${APP_URL}/api/config`,
    handshakeUrl:
      process.env.NEXT_PUBLIC_HANDSHAKE_API_URL || `${APP_URL}/api/handshake`,
    refreshCreditsUrl:
      process.env.NEXT_PUBLIC_REFRESH_CREDITS_API_URL || `${APP_URL}/api/refresh-credits`,
    supportUrl: process.env.NEXT_PUBLIC_SUPPORT_API_URL || `${APP_URL}/api/support`,
    createTransactionUrl:
      process.env.NEXT_PUBLIC_CREATE_TRANSACTION_API_URL ||
      `${APP_URL}/api/create-transaction`,
    saveHistoryUrl:
      process.env.NEXT_PUBLIC_SAVE_HISTORY_API_URL || `${APP_URL}/api/save-history`,
  },

  // CORS allowed origins for serverless API routes
  allowedOrigins: [
    "https://vectorizerr.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as const;
