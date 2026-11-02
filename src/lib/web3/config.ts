import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, arbitrum, polygon, base, sepolia, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/react';

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'b56e18d47c72ab683b10814fe9495694';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, base, polygon, arbitrum, sepolia];

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

// Initialize AppKit at module level so hooks work in SSR and Client
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
  },
});
