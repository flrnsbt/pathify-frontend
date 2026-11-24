const ALLOWED_ORIGINS = ['https://pathify.art', 'https://vectorizerr.pages.dev'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Firebase-AppCheck', 'X-Debug-Secret', 'X-Testnet-Secret'];
const ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'];
const _DEBUG_ALLOWED_ORIGINS = ['http://localhost:3000'];
/**
 * Returns CORS headers for the given request origin.
 */
export function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin');
  const headers = new Headers();
  if (origin && [...ALLOWED_ORIGINS, ..._DEBUG_ALLOWED_ORIGINS].includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return headers;
}

/**
 * Handles OPTIONS preflight requests by returning the appropriate CORS headers.
 */
export function handleOptions(request: Request): Response {
  const headers = getCorsHeaders(request);
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}

/**
 * Validates the request origin against allowed origins.
 *
 * Allowed origins:
 * - pathify.art / vectorizerr.pages.dev (always allowed)
 * - localhost:3000 (only allowed if DEBUG_SECRET header matches env var)
 *
 * Returns null if the origin is allowed, or a 403 Response if rejected.
 */
export function validateOrigin(
  request: Request,
  debugSecret: string | undefined
): Response | null {
  const origin = request.headers.get('Origin');
  if (!origin) {
    // No origin header — allow requests (same-origin or non-browser clients)
    return null;
  }

  // Always allow production origins
  if (ALLOWED_ORIGINS.includes(origin)) {
    return null;
  }

  // Allow localhost:3000 only if DEBUG_SECRET matches
  if (_DEBUG_ALLOWED_ORIGINS.includes(origin)) {
    const headerSecret = request.headers.get('X-Debug-Secret');
    if (headerSecret && debugSecret && headerSecret === debugSecret) {
      return null;
    }
  }

  return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface BackendEnv {
  BACKEND_URL?: string;
  API_SECRET?: string;
  DEBUG_SECRET?: string;
}

/**
 * Proxies a request to the backend at `path`.
 * Handles OPTIONS preflight, origin validation, API_SECRET injection,
 * and forwards App Check, Authorization, and testnet secret headers.
 */
export async function proxyRequest(
  request: Request,
  env: BackendEnv,
  path: string
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  const originCheck = validateOrigin(request, env.DEBUG_SECRET);
  if (originCheck) return originCheck;

  if (!env.BACKEND_URL) {
    return new Response(JSON.stringify({ error: 'Backend URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (env.API_SECRET) headers.set('x-api-secret', env.API_SECRET);

  for (const name of ['X-Firebase-AppCheck', 'Authorization', 'X-Testnet-Secret']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method;
  const res = await fetch(`${env.BACKEND_URL}${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : await request.text(),
  });

  const data = await res.text();
  const corsHeaders = getCorsHeaders(request);
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(corsHeaders.entries()) },
  });
}
