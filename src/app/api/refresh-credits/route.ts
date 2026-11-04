import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

export const dynamic = 'force-dynamic';

/**
 * Next.js Server-Side Proxy for Refresh Credits endpoint.
 * Secures requests by injecting the private API_SECRET server-side,
 * ensuring no API secrets are exposed to the browser client or DevTools.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workerEndpoint = APP_CONFIG.api.refreshCreditsUrl;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 1. Inject private server-side secret (never seen by browser)
    const serverSecret = process.env.API_SECRET;
    if (serverSecret) {
      headers['x-api-secret'] = serverSecret;
    }

    // 2. Forward App Check token from client
    const appCheck = request.headers.get('X-Firebase-AppCheck');
    if (appCheck) {
      headers['X-Firebase-AppCheck'] = appCheck;
    }

    // 3. Forward Authorization header from client
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const workerRes = await fetch(workerEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await workerRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: workerRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal proxy error' },
      { status: 500 }
    );
  }
}
