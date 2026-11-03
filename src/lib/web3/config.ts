import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, arbitrum, polygon, base, bsc, sepolia, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/react';

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID as string;

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, bsc, polygon, base, arbitrum, sepolia];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const metadata = {
  name: 'vectorizerr',
  description: 'Private in-browser vector graphics studio',
  url: 'https://vectorizerr.app',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Initialize AppKit with only Web3 wallets enabled (no social media or email logins)
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
    email: false,
    socials: false,
    emailShowWallets: true,
    allWallets: true,
  },
  allWallets: 'SHOW',
  enableWallets: true,
});
