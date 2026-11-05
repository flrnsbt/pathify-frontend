import type { EventContext } from '@cloudflare/workers-types';
import { validateOrigin, handleOptions, getCorsHeaders } from '../../utils';

interface Env {
  BACKEND_URL: string;
  API_SECRET?: string;
  DEBUG_SECRET?: string;
}

/**
 * Cloudflare Function proxy for /api/support
 * Injects API_SECRET server-side and forwards auth headers.
 */
export async function onRequest(context: EventContext<Env, string, unknown>) {
  if (context.request.method === 'OPTIONS') {
    return handleOptions(context.request);
  }

  const originCheck = validateOrigin(context.request, context.env.DEBUG_SECRET);
  if (originCheck) return originCheck;

  const backendUrl = context.env.BACKEND_URL;
  if (!backendUrl) {
    return new Response(JSON.stringify({ error: 'Backend URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  const apiSecret = context.env.API_SECRET;
  if (apiSecret) headers.set('x-api-secret', apiSecret);

  const appCheck = context.request.headers.get('X-Firebase-AppCheck');
  if (appCheck) headers.set('X-Firebase-AppCheck', appCheck);

  const authHeader = context.request.headers.get('Authorization');
  if (authHeader) headers.set('Authorization', authHeader);

  const userAgent = context.request.headers.get('User-Agent');
  if (userAgent) headers.set('User-Agent', userAgent);

  const body = await context.request.text();

  const res = await fetch(`${backendUrl}/api/support`, {
    method: 'POST',
    headers,
    body,
  });

  const data = await res.text();
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(corsHeaders.entries()) },
  });
}
