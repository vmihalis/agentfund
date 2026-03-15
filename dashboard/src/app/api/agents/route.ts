/**
 * GET /api/agents
 *
 * Returns agent identity data with public keys and Solscan links.
 * Reads keys/addresses.json from the project root.
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mapAgentInfos, buildFallbackAgents } from '@/lib/agents';
import type { AddressesFile } from '@/lib/agents';

export async function GET() {
  try {
    const addressesPath = path.join(process.cwd(), '..', 'keys', 'addresses.json');
    const raw = fs.readFileSync(addressesPath, 'utf-8');
    const addresses: AddressesFile = JSON.parse(raw);
    const agents = mapAgentInfos(addresses);
    return NextResponse.json(agents);
  } catch {
    // Fallback when addresses.json is missing or malformed
    const fallback = buildFallbackAgents();
    return NextResponse.json(fallback);
  }
}
