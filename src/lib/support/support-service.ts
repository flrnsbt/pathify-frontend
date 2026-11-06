import { APP_CONFIG } from '@/config/app.config';
import { getAppCheckToken } from '../firebase/app-check';
import { auth } from '../firebase/config';
import { handleAuthExpired } from '../firebase/auth-context';
import { buildApiHeaders } from '../api-headers';

export interface SupportTicketInput {
  name?: string;
  email: string;
  category: 'crypto_transaction' | 'credits_billing' | 'technical' | 'general';
  subject?: string;
  message: string;
  txHash?: string;
  chainKey?: string;
  walletAddress?: string;
}

export interface SupportTicketResponse {
  success: boolean;
  ticketId?: string;
  message?: string;
  error?: string;
}

/**
 * Submits a customer assistance request to the backend worker.
 * Secures the request with:
 * 1. Firebase App Check token
 * 2. Backend shared API secret header (x-api-secret)
 * 3. Firebase ID token (if authenticated)
 * The destination SUPPORT_EMAIL is safely resolved server-side and never exposed to the client.
 */
export async function submitSupportTicket(
  input: SupportTicketInput
): Promise<SupportTicketResponse> {
  // 1. Attach Firebase App Check token
  let appCheckToken: string | null | undefined;
  try {
    appCheckToken = await getAppCheckToken();
  } catch (err) {
    console.warn('[Support] Could not acquire App Check token:', err);
  }

  // 2. Attach Firebase Auth token if user is signed in
  const currentUser = auth.currentUser;
  let idToken: string | undefined;
  if (currentUser) {
    try {
      idToken = await currentUser.getIdToken();
    } catch (err) {
      console.warn('[Support] Could not acquire ID token, session expired:', err);
      await handleAuthExpired();
    }
  }

  const headers = buildApiHeaders({ appCheckToken, idToken });

  const endpoint = APP_CONFIG.api.supportUrl || '/api/support';

  try {
    let response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...input,
      }),
    });

    let data = await response.json().catch(() => ({}));

    // If a direct backend endpoint rejected the request due to missing x-api-secret,
    // automatically fallback to the local server proxy route which injects the private secret.
    if (
      response.status === 401 &&
      endpoint !== '/api/support' &&
      data.error &&
      /x-api-secret/i.test(data.error)
    ) {
      console.warn(
        '[Support] Direct endpoint rejected missing x-api-secret. Retrying via /api/support proxy...'
      );
      response = await fetch('/api/support', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...input,
        }),
      });
      data = await response.json().catch(() => ({}));
    }

    if (response.status === 401) {
      if (data.error && /expired|invalid.*token/i.test(data.error)) {
        try {
          if (currentUser) {
            await currentUser.getIdToken(true);
            console.warn('[Support] Session confirmed active with Google. Skipping disconnect.');
          } else {
            await handleAuthExpired();
          }
        } catch {
          await handleAuthExpired();
        }
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      ticketId: data.ticketId,
      message: data.message,
    };
  } catch (err: unknown) {
    console.error('[Support] Network error submitting support ticket:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg || 'Network error connecting to support server. Please try again.',
    };
  }
}
