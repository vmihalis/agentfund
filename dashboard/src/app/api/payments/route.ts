/**
 * GET /api/payments
 *
 * Returns x402 payment history data.
 * Currently returns demo/static data since there is no persistent
 * payment log -- x402 transactions are on-chain but not indexed.
 */

import { NextResponse } from 'next/server';
import { getDemoPayments } from '@/lib/payments';

export async function GET() {
  const payments = getDemoPayments();
  return NextResponse.json(payments);
}
