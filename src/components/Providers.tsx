'use client';

import React from 'react';
import { AuthProvider } from '../lib/firebase/auth-context';
import { Web3Provider } from '../lib/web3/web3-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Web3Provider>{children}</Web3Provider>
    </AuthProvider>
  );
}
