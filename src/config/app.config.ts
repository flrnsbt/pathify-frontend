/**
 * Application Configuration & Feature Flags
 * Centralized settings for vectorizerr frontend and API routes.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';


export const APP_CONFIG = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
  name: "vectorizerr",
  displayName: "Vectorizerr",
  debugSecret: process.env.NEXT_PUBLIC_DEBUG_SECRET || "",
  testnetSecret: process.env.NEXT_PUBLIC_TESTNET_SECRET || "",
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
    appConfigUrl: `${API_URL}/app-config`,
    userWalletUrl: `${API_URL}/user-wallet`,
    configUrl: `${API_URL}/crypto-config`,
    handshakeUrl: `${API_URL}/handshake`,
    refreshCreditsUrl: `${API_URL}/refresh-credits`,
    supportUrl: `${API_URL}/support`,
    createTransactionUrl: `${API_URL}/create-transaction`,
    saveHistoryUrl: `${API_URL}/save-history`,
    claimWelcomeCreditsUrl: `${API_URL}/claim-welcome-credits`,
  },

  // Official social/community profiles. Empty strings hide the links —
  // only fill in URLs for accounts that actually exist.
  socials: {
    twitter: "",
    github: "",
    discord: "",
  },

  // CORS allowed origins
  allowedOrigins: [
    "https://vectorizerr.pages.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
} as const;
