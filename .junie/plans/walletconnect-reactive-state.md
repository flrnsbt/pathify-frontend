---
sessionId: session-261105-122917-4ci8
---

# Problem Analysis

### Current Issues

1. **Network card clicks don't trigger wallet chain switches** — In `CreditModal.tsx`, the chain card `onClick` handler calls `setSelectedChainKey(key)` only (line 765), which updates the UI selection but does **not** call `handleSelectChain()` (line 221) which contains the actual `switchChainAsync` logic. So clicking a chain card never triggers a wallet network switch.

2. **No reactive listening to wallet chain changes** — The app uses `useAppKitNetwork()` and `useChainId()` from wagmi, but there's no `useEffect` that watches for wallet-initiated chain changes (e.g., user switches network in MetaMask directly). The `currentChainId` variable is computed per-render but nothing reacts to it proactively.

3. **Reown AppKit network switch dialog shows all chains** — The `createAppKit` in `config.ts` receives `networks` (line 159), but the `WagmiAdapter` receives `allNetworks` (line 141). The `networks` variable is set to `mainnetNetworks` (line 123) which includes 9 chains. When testing on localhost with `testnet`, the user sees mainnet chains in the switch dialog because the `networks` passed to `createAppKit` doesn't respect the testnet mode.

4. **Testnet/Mainnet mismatch** — The `networks` export is hardcoded to `mainnetNetworks` (line 123), but the user tests with `TESTNET_SECRET`. The `WagmiAdapter` gets `allNetworks` which includes both, but `createAppKit` gets only `mainnetNetworks`. This means the network modal shows mainnet chains even in testnet mode.

### Root Causes
- **`CreditModal.tsx:765`** — `onClick={() => setSelectedChainKey(key)}` should call `handleSelectChain(key)` instead
- **`config.ts:123`** — `networks` is hardcoded to `mainnetNetworks`; should be dynamically derived from the backend testnet flag
- **No wallet chain-change listener** — No `useEffect` watches `currentChainId` changes from the wallet and updates app state accordingly
- **`createAppKit` receives `networks`** which controls what appears in the network switch modal — it should only include the chains relevant to the current environment (testnet vs mainnet) and ideally only the chains that have payment wallets configured

# Technical Design

### Current Implementation

**`src/lib/web3/config.ts`** — Reown AppKit + Wagmi setup:
- `WagmiAdapter` receives `allNetworks` (all 17 chains)
- `createAppKit` receives `networks` = `mainnetNetworks` (hardcoded, 9 chains)
- `networks` parameter in `createAppKit` controls what chains appear in the network switch modal

**`src/lib/web3/web3-provider.tsx`** — Provider wrapper:
- Wraps app in `WagmiProvider` + `QueryClientProvider`
- `WalletSync` component subscribes to wagmi connection state to link wallet address to Firestore user

**`src/components/CreditModal.tsx`** — Payment modal:
- Uses `useAppKitNetwork()`, `useAppKitAccount()`, `useSwitchChain()`, `useChainId()`
- `handleSelectChain()` (line 221) does auto-switch but is **never called from the UI**
- Chain card `onClick` (line 765) only calls `setSelectedChainKey(key)` — no switch
- `handlePayWithWeb3()` (line 418) does switch before payment, but the mismatch warning already shows

### Key Decisions

1. **Fix chain card click to call `handleSelectChain`** — The simplest fix: change `onClick` on chain cards from `setSelectedChainKey(key)` to `handleSelectChain(key)`. This will trigger the auto-switch logic already written.

2. **Add a `useEffect` to react to wallet chain changes** — Watch `currentChainId` from `useAppKitNetwork()` / wagmi. When the wallet switches chain externally (e.g., user clicks in MetaMask), update `selectedChainKey` in the app to match. This keeps app state in sync with wallet state.

3. **Make `createAppKit` `networks` dynamic** — Instead of hardcoding `mainnetNetworks`, derive the networks list from the backend config (`isTestnet` flag). Only pass the relevant chains (testnet or mainnet) to `createAppKit`, so the network switch modal shows only the appropriate chains.

4. **Further narrow `networks` to only chains with payment wallets** — The `networks` passed to `createAppKit` should ideally be the intersection of the environment chains (testnet/mainnet) and the chains that have valid payment wallets configured. This minimizes the network list in the switch dialog to only what the app actually accepts.

5. **Use `useAppKitNetwork().switchNetwork` instead of wagmi's `useSwitchChain`** — Reown's native `switchNetwork` from `useAppKitNetwork()` is the recommended approach and handles the modal fallback internally. But we'll keep wagmi's `switchChainAsync` as it works and is already integrated.

### Proposed Changes

#### 1. Fix chain card click handler (`CreditModal.tsx`)
- Change `onClick={() => setSelectedChainKey(key)}` to `onClick={() => handleSelectChain(key)}` on the chain card buttons (line 765)

#### 2. Add wallet chain-change listener (`CreditModal.tsx`)
- Add a `useEffect` that watches `currentChainId` and auto-updates `selectedChainKey` when the wallet switches chain externally
- This keeps the UI in sync with the wallet state

#### 3. Create a `useWalletState` hook (`src/hooks/useWalletState.ts`)
- Extract wallet state logic into a reusable hook that:
  - Exposes `address`, `isConnected`, `chainId`, `selectedChainKey`
  - Listens for wallet-initiated chain changes
  - Auto-syncs `selectedChainKey` to match wallet chain
  - Provides a `switchChain` action

#### 4. Make AppKit networks dynamic (`config.ts`)
- Create a function to derive the correct networks list based on backend config (`isTestnet`)
- Pass only the relevant chains to `createAppKit` so the network switch modal shows only appropriate chains
- Since `createAppKit` is called at module initialization (before backend config is fetched), we'll need to use `appKit.updateNetworks()` or similar to update after config loads

#### 5. Update `Web3Provider` to sync networks after backend config loads
- In `web3-provider.tsx`, after fetching backend config, update the AppKit networks to the correct set

### File Changes

| File | Change |
|------|--------|`src/components/CreditModal.tsx`| Fix chain card `onClick`, add wallet chain-change `useEffect` |
|`src/lib/web3/config.ts`| Add dynamic network derivation, expose update function |
|`src/lib/web3/web3-provider.tsx`| Update AppKit networks after backend config loads |
|`src/hooks/useWalletState.ts`| **New** — reusable wallet state hook with reactive chain sync |

# Delivery Steps

### ✓ Step 1: Fix chain card click and add reactive wallet chain sync
Fix the chain card click handler in CreditModal to trigger network switches, and add a useEffect to react to wallet-initiated chain changes.
- Change `onClick` on chain cards from `setSelectedChainKey(key)` to `handleSelectChain(key)` so clicking a chain card triggers the auto-switch logic
- Add a `useEffect` that watches `currentChainId` from `useAppKitNetwork()` and auto-updates `selectedChainKey` when the wallet switches chain externally (e.g., user clicks in MetaMask)
- Clear the `switchFailedChainId` state when the wallet chain matches the selected chain
- This resolves both the 'clicking a network card does nothing' and the 'Wallet on different network' warning issues

### ✓ Step 2: Make AppKit networks dynamic per environment
Make the networks shown in the Reown network switch modal respect the testnet/mainnet environment.
- In `config.ts`, create a function to derive the correct networks list based on the backend `isTestnet` flag
- In `web3-provider.tsx`, fetch backend config on mount and call `appKit.updateNetworks()` (or equivalent) to update the networks list after config loads
- This ensures the network switch dialog only shows testnet chains when testing with `TESTNET_SECRET`, and mainnet chains in production
- The WagmiAdapter already receives `allNetworks` so it can handle RPC calls to any chain; only the `createAppKit` `networks` parameter controls the modal display