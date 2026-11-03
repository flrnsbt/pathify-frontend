'use client';

import { auth } from '../firebase/config';
import { getAppCheckToken } from '../firebase/app-check';
import { APP_CONFIG } from '@/config/app.config';

export interface HandshakeTicket {
  ticketId: string;
  userId: string;
  imageHash: string;
  generationsRemaining: number;
  generationsUsed: number;
  maxGenerations: number;
  expiresAt: number;
  issuedAt: number;
  nonce: string;
  signature: string;
}

export type HandshakeAction = 'unlock_image' | 'consume_generation' | 'verify_ticket';

export interface HandshakeRequest {
  action: HandshakeAction;
  imageHash: string;
  ticketId?: string;
}

export interface HandshakeResponse {
  success: boolean;
  ticket?: HandshakeTicket;
  error?: string;
  generationsRemaining?: number;
  creditsRemaining?: number;
}

// In-memory session cache of cryptographically validated tickets
const ticketCache = new Map<string, HandshakeTicket>();

/**
 * Stores an active cryptographic ticket in the session memory
 */
export function setSessionTicket(imageHash: string, ticket: HandshakeTicket): void {
  ticketCache.set(imageHash, ticket);
  try {
    sessionStorage.setItem(`vz_ticket_${imageHash}`, JSON.stringify(ticket));
  } catch {}
}

/**
 * Retrieves a valid, non-expired session ticket for the given image hash
 */
export function getSessionTicket(imageHash: string): HandshakeTicket | null {
  // Check memory first
  const memoryTicket = ticketCache.get(imageHash);
  if (memoryTicket && memoryTicket.expiresAt > Date.now()) {
    return memoryTicket;
  }

  // Check sessionStorage fallback
  try {
    const raw = sessionStorage.getItem(`vz_ticket_${imageHash}`);
    if (raw) {
      const parsed: HandshakeTicket = JSON.parse(raw);
      if (parsed.expiresAt > Date.now() && parsed.imageHash === imageHash) {
        ticketCache.set(imageHash, parsed);
        return parsed;
      }
    }
  } catch {}

  return null;
}

/**
 * Checks if the user currently holds a valid cryptographic handshake ticket for this image
 */
export function hasValidSessionTicket(imageHash?: string): boolean {
  if (!imageHash) return false;
  const ticket = getSessionTicket(imageHash);
  return Boolean(ticket && ticket.generationsRemaining > 0 && ticket.expiresAt > Date.now());
}

/**
 * Executes a Cryptographic Server Handshake to authorize image unlocks or generation consumption.
 * Protects against client-side tampering by verifying App Check and Firebase Auth tokens server-side.
 */
export async function requestServerHandshake(
  request: HandshakeRequest
): Promise<HandshakeResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return {
      success: false,
      error: 'User not authenticated. Please sign in to authorize vectorization.',
    };
  }

  try {
    // 1. Obtain Firebase Auth ID token
    const idToken = await currentUser.getIdToken(false);

    // 2. Obtain Firebase App Check token
    const appCheckToken = await getAppCheckToken();

    // 3. Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };

    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    if (APP_CONFIG.api.apiSecret) {
      headers['x-api-secret'] = APP_CONFIG.api.apiSecret;
    }

    const endpoint =
      process.env.NEXT_PUBLIC_HANDSHAKE_API_URL || '/api/handshake';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const data: HandshakeResponse = await res.json().catch(() => ({
      success: false,
      error: `Server responded with status ${res.status}`,
    }));

    if (!res.ok || !data.success || !data.ticket) {
      return {
        success: false,
        error: data.error || 'Cryptographic handshake rejected by server.',
      };
    }

    // 4. Save validated ticket to session
    setSessionTicket(request.imageHash, data.ticket);

    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Handshake] Error during cryptographic server handshake:', err);
    return {
      success: false,
      error: `Handshake connection error: ${msg}`,
    };
  }
}
