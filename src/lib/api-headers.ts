/**
 * Builds shared HTTP headers for Cloudflare Functions API calls.
 *
 * Includes:
 * - Content-Type: application/json
 * - X-Firebase-AppCheck (if appCheckToken provided)
 * - Authorization: Bearer &lt;token&gt; (if idToken provided)
 * - X-Debug-Secret (if debugSecret is set in app config)
 * - x-testnet-secret (if testnetSecret is set in app config)
 */

import { APP_CONFIG } from '@/config/app.config';

export interface BuildApiHeadersOptions {
  appCheckToken?: string | null;
  idToken?: string;
}

export function buildApiHeaders(options?: BuildApiHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options?.appCheckToken) {
    headers['X-Firebase-AppCheck'] = options.appCheckToken;
  }

  if (options?.idToken) {
    headers['Authorization'] = `Bearer ${options.idToken}`;
  }

  if (APP_CONFIG.debugSecret) {
    headers['X-Debug-Secret'] = APP_CONFIG.debugSecret;
  }

  if (APP_CONFIG.testnetSecret) {
    headers['x-testnet-secret'] = APP_CONFIG.testnetSecret;
  }

  return headers;
}
