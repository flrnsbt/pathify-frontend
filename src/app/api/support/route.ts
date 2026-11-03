import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

/**
 * Next.js Edge / Serverless Proxy for Support endpoint
 * Forwards requests to the backend worker with security headers if configured.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workerEndpoint = APP_CONFIG.api.backendUrl
      ? `${APP_CONFIG.api.backendUrl}/api/support`
      : 'https://api.vectorizerr.workers.dev/api/support';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 1. Inject private server-side secret (never seen by browser)
    const serverSecret = process.env.API_SECRET;
    if (serverSecret) {
      headers['x-api-secret'] = serverSecret;
    }

    const appCheck = request.headers.get('X-Firebase-AppCheck');
    if (appCheck) {
      headers['X-Firebase-AppCheck'] = appCheck;
    }

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
