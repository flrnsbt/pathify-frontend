import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

/**
 * Next.js Edge / Serverless Proxy for Save History endpoint.
 * Injects private API_SECRET server-side so secrets never reach the browser client,
 * and forwards App Check and Firebase Auth tokens to the Cloudflare Worker backend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workerEndpoint = APP_CONFIG.api.backendUrl
      ? `${APP_CONFIG.api.backendUrl}/api/save-history`
      : 'https://api.vectorizerr.workers.dev/api/save-history';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 1. Inject private server-side secret (never seen by browser DevTools)
    const serverSecret = process.env.API_SECRET;
    if (serverSecret) {
      headers['x-api-secret'] = serverSecret;
    }

    // 2. Forward App Check token
    const appCheck = request.headers.get('X-Firebase-AppCheck');
    if (appCheck) {
      headers['X-Firebase-AppCheck'] = appCheck;
    }

    // 3. Forward Authorization token
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
