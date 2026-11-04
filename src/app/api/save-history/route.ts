import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

export const dynamic = 'force-dynamic';

/**
 * Proxy for save-history. Injects API_SECRET server-side.
 * Body: { imageHash, svg }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workerEndpoint = APP_CONFIG.api.saveHistoryUrl;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const serverSecret = process.env.API_SECRET;
    if (serverSecret) headers['x-api-secret'] = serverSecret;

    const appCheck = request.headers.get('X-Firebase-AppCheck');
    if (appCheck) headers['X-Firebase-AppCheck'] = appCheck;

    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    // Send only imageHash and svg to backend
    const minimalBody = { imageHash: body.imageHash, svg: body.svg };

    const workerRes = await fetch(workerEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(minimalBody),
    });

    const data = await workerRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: workerRes.status });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
