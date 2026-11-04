import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

// Force dynamic so this route works with output: "export" builds
export const dynamic = 'force-dynamic';

/**
 * Proxy for config. Injects API_SECRET server-side and forwards App Check and testnet secret.
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = APP_CONFIG.api.backendUrl;
    if (!backendUrl) {
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }
    const workerEndpoint = `${backendUrl}/api/config`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const serverSecret = process.env.API_SECRET;
    if (serverSecret) headers['x-api-secret'] = serverSecret;

    const appCheck = request.headers.get('X-Firebase-AppCheck');
    if (appCheck) headers['X-Firebase-AppCheck'] = appCheck;

    const testnetSecret = APP_CONFIG.testnetSecret;
    if (testnetSecret) headers['x-testnet-secret'] = testnetSecret;

    const workerRes = await fetch(workerEndpoint, {
      method: 'GET',
      headers,
    });

    const data = await workerRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: workerRes.status });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
