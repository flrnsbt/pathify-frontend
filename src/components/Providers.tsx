'use client';

import React from 'react';
import { AuthProvider } from '../lib/firebase/auth-context';
import { Web3Provider } from '../lib/web3/web3-provider';
import { I18nProvider } from '../lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <Web3Provider>{children}</Web3Provider>
      </AuthProvider>
    </I18nProvider>
  );
}
