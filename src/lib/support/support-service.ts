import { APP_CONFIG } from '@/config/app.config';
import { getAppCheckToken } from '../firebase/app-check';
import { auth } from '../firebase/config';

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 1. Attach Firebase App Check token
  try {
    const appCheckToken = await getAppCheckToken();
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }
  } catch (err) {
    console.warn('[Support] Could not acquire App Check token:', err);
  }

  // 3. Attach Firebase Auth token if user is signed in
  const currentUser = auth.currentUser;
  let userId: string | undefined;
  if (currentUser) {
    try {
      userId = currentUser.uid;
      const idToken = await currentUser.getIdToken(false);
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (err) {
      console.warn('[Support] Could not acquire ID token:', err);
    }
  }

  const endpoint = APP_CONFIG.api.supportUrl || '/api/support';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...input,
        userId,
      }),
    });

    const data = await response.json().catch(() => ({}));

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
  } catch (err: any) {
    console.error('[Support] Network error submitting support ticket:', err);
    return {
      success: false,
      error: err?.message || 'Network error connecting to support server. Please try again.',
    };
  }
}
