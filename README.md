# vectorizerr

High-performance raster to vector graphics (SVG) converter studio. Data is temporarily saved for convenience, is never used for any secondary purposes, and remains strictly private and confidential. Powered by **Next.js**, **Web Workers**, **VTracer**, **Firebase Auth & Firestore**, and **Web3 WalletConnect / Reown AppKit**.

---

## 🚀 Key Features & Architectural Blueprint

### 1. Data Confidentiality & Core Studio
- **Strict Privacy**: Uploaded images and vector assets are temporarily saved solely for user convenience, allowing responsive previews, comparison sliders, and format downloads. Data is never used for secondary purposes, is never used to train AI models, and remains completely private.
- **Free Raster Downloads**: Anyone can convert and freely download high-resolution raster files in **PNG** or **WebP** formats without logging in or using credits.
- **Smart SVG Export & Quota System**: Unlocking full SVG export requires 1 credit per image hash, granting **10 vector re-generations** on that image so you can fine-tune presets, color clustering, and spline tolerances without paying again.

### 2. Multi-Chain Web3 Payments & Real-Time Rates
- **Supported Blockchains**: BNB Smart Chain (BSC), Ethereum (ETH), Polygon (POL), Base, and Arbitrum One.
- **Tokens**: Native coins (BNB, ETH, POL) plus BEP-20 / ERC-20 stablecoins (USDT, USDC).
- **Real-Time Conversion Rates**: Live CoinGecko / CryptoCompare price feeds dynamically price credit packs without hardcoding.
- **Dynamic Chain Filtering**: Supported networks are automatically derived from wallet JSON configuration files; networks without a defined recipient address are safely hidden.
- **On-Demand Transaction Verification**: Users can monitor confirmations in real-time or click "Refresh Credits" to instantly reconcile on-chain deposits via our edge worker.

### 3. End-to-End Cryptographic Security & Anti-Abuse
- **Firebase App Check**: All calls to Firestore, Firebase Auth, and our backend edge worker are attested with App Check (reCAPTCHA Enterprise & v3) verified cryptographically against Google's public JWKS endpoint (`https://firebaseappcheck.googleapis.com/v1/jwks`).
- **Cryptographic Server Handshake**: Image unlock tickets and generation counters are signed with HMAC-SHA256 (`ticketId:userId:imageHash:generationsRemaining:expiresAt:nonce`), preventing client-side tamper or bypass via browser DevTools.
- **Backend API Secret (`x-api-secret`)**: Requests to backend worker endpoints must include a valid API secret header matching `env.API_SECRET`.
- **CORS Protection**: Edge endpoints are strictly restricted to authorized origins: `https://vectorizerr.pages.dev`, `http://localhost:3000`, and `http://127.0.0.1:3000`.

### 4. Legal & Customer Assistance Portal
- **Privacy Policy (`/privacy` & `/policy`)**: Comprehensive privacy documentation detailing our zero-upload architecture, data retention, and user rights.
- **Conditions of Use (`/terms` & `/conditions`)**: Transparent terms covering 100% user copyright ownership of generated SVG files, crypto payment irreversibility, and acceptable use policies.
- **Contact Support (`/support` & `/contact`)**: Confidential customer assistance form with specialized fields for cryptocurrency transaction assistance (Tx Hash, Chain, Wallet Address). Inquiries trigger edge email delivery to `SUPPORT_EMAIL` (`contact@floriansabate.top`) without exposing the address to the browser, while logging an immutable ticket in Firestore.

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory (refer to `.env.example`):

```bash
# Web3 / Reown AppKit
NEXT_PUBLIC_REOWN_PROJECT_ID=your-project-id

# Firebase App Check
NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY=your-recaptcha-key
# NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=true # for local development

# Cryptographic Handshake & API Secret
HANDSHAKE_SECRET=your-32-char-random-secret
API_SECRET=your-backend-api-secret
NEXT_PUBLIC_API_SECRET=your-backend-api-secret

# Backend Worker Integration
NEXT_PUBLIC_BACKEND_URL=https://api.vectorizerr.workers.dev
NEXT_PUBLIC_REFRESH_CREDITS_FUNCTION_URL=https://api.vectorizerr.workers.dev/api/refresh-credits
NEXT_PUBLIC_SUPPORT_API_URL=https://api.vectorizerr.workers.dev/api/support

# Application Settings
NEXT_PUBLIC_APP_URL=https://vectorizerr.pages.dev
OUTPUT_MODE=export
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Building & Deployment

### Next.js Production Build
```bash
npm run build
```

### Cloudflare OpenNext Edge Deployment
```bash
npm run cloudflare-build
```

### Static Cloudflare Pages Deployment
```bash
OUTPUT_MODE=export npm run build
npx wrangler pages deploy out --project-name=vtracer-studio
```

---

## 📂 Project Structure

```
vectorizerr-frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main Vectorizer Studio with Split-Screen & Controls
│   │   ├── transactions/          # Crypto Transactions History & On-Demand Reconcile
│   │   ├── support/               # Customer Assistance & Transaction Inquiries
│   │   ├── contact/               # Alias for /support
│   │   ├── privacy/               # Privacy Policy
│   │   ├── policy/                # Alias for /privacy
│   │   ├── terms/                 # Conditions of Use & Terms of Service
│   │   ├── conditions/            # Alias for /terms
│   │   └── api/
│   │       ├── handshake/         # Cryptographic ticket validation
│   │       └── support/           # Next.js API edge proxy for support tickets
│   ├── components/
│   │   ├── Header.tsx             # Navigation bar with credit badge & support links
│   │   ├── Footer.tsx             # Global aesthetic footer with policy links
│   │   ├── Visualizer.tsx         # Responsive canvas with Zoom, Pan, Split-Screen
│   │   ├── ControlsPanel.tsx      # Precision sliders, Presets, and Color Clustering
│   │   ├── Uploader.tsx           # Drag & Drop with local image decoders
│   │   ├── CreditModal.tsx        # Multi-chain crypto checkout & live rates
│   │   └── UnlockModal.tsx        # 1-credit image unlock & 10-quota confirmation
│   ├── config/
│   │   └── app.config.ts          # Centralized settings & feature flags
│   ├── hooks/
│   │   ├── useVTracer.ts          # Web Worker lifecycle & progressive vectorization
│   │   └── useTransactionListener.ts # Real-time Firestore transaction listener
│   ├── lib/
│   │   ├── firebase/              # Auth, Firestore REST & App Check JWKS init
│   │   ├── security/              # Cryptographic handshake client
│   │   ├── support/               # Support ticket submission service
│   │   ├── vtracer/               # VTracer WASM bindings & export tools
│   │   └── web3/                  # Reown AppKit & Multi-chain wallet configs
│   └── workers/
│       └── vtracer.worker.ts      # Offscreen background vectorization worker
└── public/
    ├── wasm/vtracer.wasm          # VTracer WebAssembly binary
    └── icon.svg                   # Vectorizerr logo
```
