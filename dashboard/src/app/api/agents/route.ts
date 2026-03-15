/**
 * GET /api/agents
 *
 * Returns agent identity data with public keys, Solscan links,
 * and Metaplex on-chain identity (asset, PDA, verification status).
 * Reads keys/addresses.json and keys/registration.json from the project root.
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mapAgentInfos, buildFallbackAgents } from '@/lib/agents';
import type { AddressesFile, RegistrationFile } from '@/lib/agents';

export async function GET() {
  try {
    const keysDir = path.join(process.cwd(), '..', 'keys');

    const addressesPath = path.join(keysDir, 'addresses.json');
    const raw = fs.readFileSync(addressesPath, 'utf-8');
    const addresses: AddressesFile = JSON.parse(raw);

    // Load Metaplex registration data (optional)
    let registration: RegistrationFile | null = null;
    const regPath = path.join(keysDir, 'registration.json');
    try {
      const regRaw = fs.readFileSync(regPath, 'utf-8');
      registration = JSON.parse(regRaw) as RegistrationFile;
    } catch {
      // registration.json not found — agents will show without Metaplex identity
    }

    const agents = mapAgentInfos(addresses, registration);
    return NextResponse.json(agents);
  } catch {
    // Fallback when addresses.json is missing or malformed
    const fallback = buildFallbackAgents();
    return NextResponse.json(fallback);
  }
}
