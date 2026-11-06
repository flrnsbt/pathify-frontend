const ALLOWED_ORIGINS = ['https://pathify.art', 'https://vectorizerr.pages.dev', 'http://localhost:3000'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Firebase-AppCheck', 'X-Debug-Secret', 'X-Testnet-Secret'];
const ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'];

/**
 * Returns CORS headers for the given request origin.
 */
export function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin');
  const headers = new Headers();
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
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
  if (origin === 'https://pathify.art' || origin === 'https://vectorizerr.pages.dev') {
    return null;
  }

  // Allow localhost:3000 only if DEBUG_SECRET matches
  if (origin === 'http://localhost:3000') {
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
