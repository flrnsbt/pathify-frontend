import type { EventContext } from '@cloudflare/workers-types';
import { proxyRequest } from '../../utils';

interface Env {
  BACKEND_URL: string;
  API_SECRET?: string;
  DEBUG_SECRET?: string;
}

/**
 * Cloudflare Function proxy for /api/app-config
 * Injects API_SECRET server-side and forwards auth headers.
 */
export async function onRequest(context: EventContext<Env, string, unknown>) {
  return proxyRequest(context.request, context.env, '/api/app-config');
}
