# vectorizerr

High-performance, private in-browser raster to vector graphics (SVG) converter. Privacy is entirely respected: all image processing runs inside an isolated, client-side private sandbox on your device. Powered by **Next.js**, **Web Workers**, **Firebase Auth & Firestore**, and **Web3 WalletConnect / Reown AppKit**.

---

## 🚀 Architecture Blueprint Overview

### 1. Build & Runtime
- **Next.js App Router** with TypeScript, Tailwind CSS v4, and ESLint.
- Multi-target deployment:
  - Local dev / node runtime with dynamic headers for `.wasm` MIME type (`application/wasm`).
  - Static export (`output: 'export'`) configured for **Cloudflare Pages** with `public/_headers` and `wrangler.json`.

### 2. VTracer WebAssembly & Web Worker
- **WASM binary (`public/wasm/vtracer.wasm`)**: WebAssembly build of Tsung-Yen Tsai's `visioncortex/vtracer` library.
- **Web Worker (`src/workers/vtracer.worker.ts`)**: Lazily initialized in a dedicated background thread to keep UI smooth and 60 FPS even on large images.
- **Custom Hook (`src/hooks/useVTracer.ts`)**: Manages worker lifecycle, progressive state, fallback execution, and termination on unmount.

### 3. Core UI & Canvas Interface
- **Drag-and-Drop Uploader**: Accepts `PNG`, `JPG`, `WEBP`, extracting clean `ImageData` arrays using an offscreen `HTMLCanvasElement`. Includes 1-click synthetic test image presets (Geometric Logo, Pixel Art, Emblem Badge).
- **Controls Panel**:
  - Color Mode: Full Color vs. Binary (Monochrome)
  - Layer Hierarchy: Stacked (overlapping) vs. Cutout (holes)
  - Curve Fitting: Spline curves, Polygon, or Raw Edges
  - Sliders: Filter Speckle (denoise), Color Precision (clustering), Layer Difference, Corner Angle Threshold, Segment Length, Max Iterations, and Path Decimal Precision.
  - Presets: Photo, Pixel Art, Line Art, Logo, Custom.
- **Interactive Visualizer**:
  - Split-screen comparison slider with drag handle.
  - Side-by-side comparison mode.
  - Vector only and Raster only views.
  - Interactive Zoom & Pan controls (+, -, 100%, pan drag).
  - Background choices: Transparent Checkerboard, Dark, Light.
  - Export actions: Download `.svg`, Copy SVG code to clipboard.

### 4. Firebase Authentication & Firestore History
- **Auth Provider (`src/lib/firebase/auth-context.tsx`)**: Google Sign-In, Email/Password login & registration, and Anonymous guest sessions.
- **Firestore History (`src/lib/firebase/firestore.ts`)**: Vectorization history saved to `users/{userId}/history` collection with metadata (node count, execution time, parameters, timestamp).
- **Security Rules (`firestore.rules`)**: Strict access control enforcing `request.auth.uid == userId`.
- **Offline / Local Fallback**: Seamless fallback to local storage if Firebase credentials are not yet configured.

### 5. Web3 / Reown AppKit Integration
- **Web3 Provider (`src/lib/web3/web3-provider.tsx`)**: Reown AppKit + Wagmi + Viem supporting Ethereum Mainnet, Base, Polygon, Arbitrum, and Sepolia.
- **Credit & Pro Tier**: Connect Wallet button, credit balance counter, and native token transfer payment trigger for purchasing credits or unlocking Pro tier.
- **Wallet Linking**: Automatic syncing of connected wallet address (`0x...`) to the authenticated Firebase user profile in Firestore.

### 6. Testing & Cloudflare Deployment
- **Performance & 4K Stress Audit Tool**: Built-in benchmark suite to stress-test Web Worker linear memory and processing throughput on 1080p, 2K, and 4K UHD resolutions.
- **CI/CD Pipeline (`.github/workflows/deploy.yml`)**: Automated GitHub Actions workflow to build and deploy static output to Cloudflare Pages via Wrangler.

---

## 🛠️ Getting Started

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Static Export
```bash
OUTPUT_MODE=export npm run build
```
The static site is exported to the `out/` directory, ready to deploy to Cloudflare Pages or any static host.

### Cloudflare Pages Deployment
```bash
npx wrangler pages deploy out --project-name=vtracer-studio
```
