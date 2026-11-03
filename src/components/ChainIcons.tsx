import React from 'react';
import { SupportedChainKey } from '../lib/web3/payment-wallets';

interface IconProps {
  className?: string;
  size?: number;
}

export function EthIcon({ className = 'w-5 h-5', size }: IconProps) {
  return (
    <svg
      viewBox="0 0 256 417"
      width={size || '100%'}
      height={size || '100%'}
      preserveAspectRatio="xMidYMid"
      className={className}
      fill="none"
    >
      <path fill="#627EEA" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
      <path fill="#8C9EEA" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
      <path fill="#4C6CDA" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.601 128.038-179.974z" />
      <path fill="#8C9EEA" d="M127.962 416.905v-104.72L0 236.585z" />
      <path fill="#3D5BC8" d="M127.961 287.958l127.96-75.637-127.96-58.162z" />
      <path fill="#5474E4" d="M0 212.32l127.96 75.638v-133.8z" />
    </svg>
  );
}

export function BscIcon({ className = 'w-5 h-5', size }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size || '100%'}
      height={size || '100%'}
      className={className}
      fill="none"
    >
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path
        fill="#FFFFFF"
        d="M12.116 14.404L16 10.519l3.886 3.886 2.26-2.26L16 6 9.856 12.144l2.26 2.26zm-6.116 1.596l2.26-2.26 2.26 2.26-2.26 2.26-2.26-2.26zm6.116 1.596l3.884 3.886 3.884-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm7.768-1.596l2.26-2.26 2.26 2.26-2.26 2.26-2.26-2.26zm-3.884 0L16 13.74l-2.26 2.26 2.26 2.26 2.26-2.26z"
      />
    </svg>
  );
}

export function BtcIcon({ className = 'w-5 h-5', size }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size || '100%'}
      height={size || '100%'}
      className={className}
      fill="none"
    >
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#FFFFFF"
        d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783-1.728-.431-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.432.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.537c-.535 2.146-4.148.986-5.318.695l.95-3.805c1.17.292 4.92.872 4.368 3.11zm.536-5.574c-.488 1.954-3.495.962-4.47.718l.86-3.45c.976.244 4.113.7 3.61 2.732z"
      />
    </svg>
  );
}

export function PolIcon({ className = 'w-5 h-5', size }: IconProps) {
  return (
    <svg
      viewBox="0 0 38 33"
      width={size || '100%'}
      height={size || '100%'}
      className={className}
      fill="none"
    >
      <path
        fill="#8247E5"
        d="M29 10.2l-7.3-4.2c-1-.6-2.3-.6-3.3 0L11 10.2c-1 .6-1.7 1.7-1.7 2.9v8.4c0 1.2.6 2.3 1.7 2.9l7.3 4.2c1 .6 2.3.6 3.3 0l7.3-4.2c1-.6 1.7-1.7 1.7-2.9v-8.4c.1-1.2-.6-2.3-1.6-2.9zm-4.4 9.1l-4.5 2.6c-.6.4-1.4.4-2 0l-4.5-2.6c-.6-.4-1-1.1-1-1.8v-5.2c0-.7.4-1.4 1-1.8l4.5-2.6c.6-.4 1.4-.4 2 0l4.5 2.6c.6.4 1 1.1 1 1.8v5.2c.1.7-.3 1.4-1 1.8z"
      />
    </svg>
  );
}

export function BaseIcon({ className = 'w-5 h-5', size }: IconProps) {
  return (
    <svg
      viewBox="0 0 115 115"
      width={size || '100%'}
      height={size || '100%'}
      className={className}
      fill="none"
    >
      <circle cx="57.5" cy="57.5" r="57.5" fill="#0052FF" />
      <path
        d="M57.5 96C78.763 96 96 78.763 96 57.5C96 36.237 78.763 19 57.5 19C36.8787 19 20.0469 35.2476 19.043 55.625H71.5V59.375H19.043C20.0469 79.7524 36.8787 96 57.5 96Z"
        fill="white"
      />
    </svg>
  );
}

export function ArbIcon({ className = 'w-5 h-5', size }: IconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size || '100%'}
      height={size || '100%'}
      className={className}
      fill="none"
    >
      <path
        d="M50 0C22.3858 0 0 22.3858 0 50C0 77.6142 22.3858 100 50 100C77.6142 100 100 77.6142 100 50C100 22.3858 77.6142 0 50 0Z"
        fill="#213147"
      />
      <path
        d="M68.5 25L52.5 50.8L68.8 77.2L77.7 62.9C79.4 60.3 79.4 56.9 77.7 54.3L68.5 25Z"
        fill="#28A0F0"
      />
      <path
        d="M31.5 25L22.3 39.8C20.6 42.4 20.6 45.8 22.3 48.4L46.6 87.5L55.4 73.2L38.9 46.8L55 21.2L31.5 25Z"
        fill="#FFFFFF"
      />
      <path d="M46.8 45.2L39.3 57.3H60.7L53.2 45.2H46.8Z" fill="#28A0F0" />
    </svg>
  );
}

export function ChainIcon({
  chainKey,
  className = 'w-5 h-5',
  size,
}: {
  chainKey: SupportedChainKey;
  className?: string;
  size?: number;
}) {
  switch (chainKey) {
    case 'bsc':
      return <BscIcon className={className} size={size} />;
    case 'eth':
      return <EthIcon className={className} size={size} />;
    case 'btc':
      return <BtcIcon className={className} size={size} />;
    case 'pol':
      return <PolIcon className={className} size={size} />;
    case 'base':
      return <BaseIcon className={className} size={size} />;
    case 'arbitrum':
      return <ArbIcon className={className} size={size} />;
    default:
      return null;
  }
}
