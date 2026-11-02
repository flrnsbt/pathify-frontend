import { NextResponse } from 'next/server';
import { parsePaymentWallets } from '@/lib/web3/payment-wallets';

export const dynamic = 'force-static';

export async function GET() {
  const wallets = parsePaymentWallets();
  return NextResponse.json({ wallets });
}
