---
sessionId: session-261105-102711-so8z
---

# Current State & Plan

### What I Found

**6 API endpoints** call the Cloudflare Functions proxy, each building headers manually:

| File | Function | Current Headers |
|------|----------|----------------|
| `src/lib/web3/payment-wallets.ts` | `fetchBackendConfig()` | Content-Type, X-Firebase-AppCheck |
| `src/lib/security/handshake.ts` | `requestServerHandshake()` | Content-Type, Authorization, X-Firebase-AppCheck |
| `src/lib/firebase/firestore.ts` | `saveVectorizationHistory()` | Content-Type, Authorization, X-Firebase-AppCheck |
| `src/lib/firebase/firestore.ts` | `createCryptoTransaction()` | Content-Type, Authorization, X-Firebase-AppCheck |
| `src/lib/firebase/firestore.ts` | `refreshUserCredits()` | Content-Type, Authorization, X-Firebase-AppCheck |
| `src/lib/support/support-service.ts` | `submitSupportTicket()` | Content-Type, Authorization, X-Firebase-AppCheck |

**Secrets available in `app.config.ts`:**
- `APP_CONFIG.debugSecret` → from `process.env.DEBUG_SECRET`
- `APP_CONFIG.testnetSecret` → from `process.env.TESTNET_SECRET`

**What the functions expect (from `functions/utils.ts` CORS config):**
- `X-Debug-Secret` — for localhost:3000 origin validation
- `X-Testnet-Secret` — forwarded to backend for testnet mode

**Neither header is currently sent by any frontend API call.**

### Plan

1. **Create `src/lib/api-headers.ts`** — a convenience function `buildApiHeaders(options)` that returns a `Record<string, string>` with:
   - `Content-Type: application/json`
   - `X-Firebase-AppCheck` (if `appCheckToken` provided)
   - `Authorization: Bearer <token>` (if `idToken` provided)
   - `X-Debug-Secret` (if `APP_CONFIG.debugSecret` is set)
   - `X-Testnet-Secret` (if `APP_CONFIG.testnetSecret` is set)

2. **Update all 6 API call sites** to use `buildApiHeaders()` instead of manual header construction:
   - `fetchBackendConfig()` in `payment-wallets.ts`
   - `requestServerHandshake()` in `handshake.ts`
   - `saveVectorizationHistory()` in `firestore.ts`
   - `createCryptoTransaction()` in `firestore.ts`
   - `refreshUserCredits()` in `firestore.ts`
   - `submitSupportTicket()` in `support-service.ts`

### Why This Matters
- `X-Debug-Secret` is required for localhost:3000 to pass the origin validation in Cloudflare Functions (otherwise you get 403 during local dev)
- `X-Testnet-Secret` tells the backend to use testnet mode for payments

# Delivery Steps

### * ✓ Step 1: Create buildApiHeaders() convenience method
Create `src/lib/api-headers.ts` with a shared header builder function.

### ✓ Step 2: Update all 6 API call sites to use buildApiHeaders()
Replace manual header construction in `payment-wallets.ts`, `handshake.ts`, `firestore.ts` (3 calls), and `support-service.ts` with the new helper.