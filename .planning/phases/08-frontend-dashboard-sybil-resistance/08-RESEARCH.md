# Phase 8: Frontend Dashboard & Sybil Resistance - Research

**Researched:** 2026-03-14
**Domain:** Next.js App Router, React dashboard, ElevenLabs React SDK, Human Passport Embed
**Confidence:** HIGH

## Summary

Phase 8 builds a Next.js dashboard as a new workspace package (`dashboard/`) inside the existing pnpm monorepo. The dashboard visualizes agent identities (with Solscan devnet links), treasury state (balance, LP positions, yield), the proposal pipeline (status progression), x402 payment history, and an ElevenLabs voice widget. A separate proposal submission page gates access behind Human Passport verification (humanity score >= 20).

The project already has all backend data sources built: Express servers (voice, scout, analyzer), agent classes with typed interfaces, keys/addresses.json for identity data, and TypedEventBus for real-time events. The dashboard consumes these via API calls to the existing Express servers and by reading static data (addresses.json, agent configs). The ElevenLabs voice widget uses the React SDK (`@elevenlabs/react`) with the `useConversation` hook, connecting via signed URLs from the existing `/api/voice/signed-url` endpoint. Human Passport uses `@human.tech/passport-embed` with `PassportScoreWidget` and `usePassportScore` hook.

**Primary recommendation:** Create the Next.js app as `dashboard/` in the pnpm workspace with App Router, using API route handlers to proxy requests to the existing Express backend servers. Keep the dashboard purely presentational -- all business logic stays in the existing `src/` codebase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Next.js dashboard showing registered agent identities with on-chain verification links | Agent data from keys/addresses.json + AGENT_CONFIGS. Solscan devnet links: `https://solscan.io/address/{pubkey}?cluster=devnet` |
| DASH-02 | Dashboard displays treasury balance, LP positions, and yield performance | TreasuryAgent.getBalance() returns TreasuryBalance with solBalance, usdcBalance, totalValueUsd, lpPositions[] |
| DASH-03 | Dashboard shows proposal pipeline (submitted, evaluating, approved, funded) | GovernanceAgent pipeline emits events. Voice server POST /api/voice/command returns pipeline results with allocations[] |
| DASH-04 | Dashboard includes voice command center (ElevenLabs widget) | @elevenlabs/react useConversation hook with signedUrl from existing /api/voice/signed-url endpoint |
| DASH-05 | Dashboard shows x402 payment history between agents | Payment data from x402 transaction logs. Can show static demo data or fetch from Solana RPC |
| SYBIL-01 | Human Passport Embed component gating proposal submission page | @human.tech/passport-embed PassportScoreWidget component with apiKey, scorerId, generateSignatureCallback |
| SYBIL-02 | Users must verify humanity (score >= 20) before submitting proposals | usePassportScore hook returns { score, isPassing }. Gate form submission on isPassing === true |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15 (latest) | App Router framework | Project constraint (Next.js dashboard). App Router is default since v13 |
| react / react-dom | ^19 | UI rendering | Bundled with Next.js 15 |
| @elevenlabs/react | latest | Voice conversation widget | Project uses ElevenLabs; React hook wraps existing voice-session pattern |
| @human.tech/passport-embed | latest | Sybil resistance widget | Project constraint for Human Passport bounty |
| tailwindcss | ^4 | Utility CSS | Fast styling for hackathon; bundled with create-next-app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | ~5.4.5 | Type safety | Match existing project tsconfig |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind | shadcn/ui | Adds component library overhead; raw Tailwind is faster for hackathon |
| API route proxies | Direct Express calls from client | CORS issues; API routes are cleaner and keep secrets server-side |
| Pages Router | App Router | App Router is the default and better for server components |

**Installation:**
```bash
# Inside the monorepo root, create dashboard workspace
cd dashboard && pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm

# Add ElevenLabs React and Human Passport
pnpm add @elevenlabs/react @human.tech/passport-embed
```

## Architecture Patterns

### Recommended Project Structure
```
dashboard/
  src/
    app/
      layout.tsx          # Root layout with dark theme
      page.tsx            # Main dashboard (agents, treasury, proposals)
      submit/
        page.tsx          # Proposal submission with Passport gate
      api/
        agents/
          route.ts        # GET: agent identities from addresses.json
        treasury/
          route.ts        # GET: proxy to TreasuryAgent.getBalance()
        voice/
          signed-url/
            route.ts      # GET: proxy to existing voice server
          command/
            route.ts      # POST: proxy to existing voice server
        proposals/
          route.ts        # GET: pipeline status; POST: submit proposal
        payments/
          route.ts        # GET: x402 payment history
    components/
      AgentCard.tsx        # Agent identity with Solscan link
      TreasuryPanel.tsx    # Balance, LP positions, yield
      ProposalPipeline.tsx # Pipeline stages visualization
      VoiceWidget.tsx      # ElevenLabs useConversation wrapper
      PaymentHistory.tsx   # x402 payment log
      PassportGate.tsx     # Human Passport verification wrapper
    lib/
      api.ts              # Fetch helpers for API routes
  next.config.ts          # Next.js config
  tailwind.config.ts      # Tailwind config
  tsconfig.json           # Separate tsconfig for Next.js
  package.json            # Workspace package
```

### Pattern 1: API Route Proxy to Express Backend
**What:** Next.js API routes proxy requests to the existing Express servers rather than importing backend code directly.
**When to use:** All data fetching from agents/treasury/voice.
**Why:** The existing Express servers run on ports 4001-4003. The Next.js dashboard runs on port 3000. API routes handle CORS and can add error handling. Backend code uses Node.js filesystem APIs (keys.ts, addresses.json) that work in API routes but not in client components.
**Example:**
```typescript
// dashboard/src/app/api/treasury/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Option A: Direct import (works because API routes run server-side)
  // Import the agent types and call treasury.getBalance() directly
  // Option B: Proxy to Express backend
  const res = await fetch('http://localhost:4003/api/voice/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'check treasury' }),
  });
  const data = await res.json();
  return NextResponse.json(data);
}
```

### Pattern 2: Static Data for Agent Identities (DASH-01)
**What:** Agent identity data is read from keys/addresses.json and AGENT_CONFIGS at build time or via API route.
**When to use:** Agent cards with Solscan links.
**Example:**
```typescript
// dashboard/src/app/api/agents/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AGENT_CONFIGS = {
  scout: { name: 'Scout Agent', description: 'Discovers grant proposals and funding opportunities via web data' },
  analyzer: { name: 'Proposal Analyzer', description: 'Evaluates proposals using AI with structured scoring' },
  treasury: { name: 'Treasury Manager', description: 'Manages funds, executes transfers, and earns yield via DeFi' },
  governance: { name: 'Governance Agent', description: 'Coordinates the funding pipeline and makes allocation decisions' },
};

export async function GET() {
  const addressesPath = path.join(process.cwd(), '..', 'keys', 'addresses.json');
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));

  const agents = Object.entries(AGENT_CONFIGS).map(([role, config]) => ({
    role,
    ...config,
    publicKey: addresses.agents[role]?.publicKey ?? 'unknown',
    solscanUrl: `https://solscan.io/address/${addresses.agents[role]?.publicKey}?cluster=devnet`,
  }));

  return NextResponse.json({ agents });
}
```

### Pattern 3: ElevenLabs Voice Widget (DASH-04)
**What:** Use `useConversation` from `@elevenlabs/react` with signed URL from existing voice server.
**When to use:** Voice command center component.
**Example:**
```tsx
// dashboard/src/components/VoiceWidget.tsx
'use client';

import { useConversation } from '@elevenlabs/react';
import { useState, useCallback } from 'react';

export function VoiceWidget() {
  const [messages, setMessages] = useState<string[]>([]);

  const conversation = useConversation({
    onMessage: ({ message, source }) => {
      setMessages(prev => [...prev, `${source}: ${message}`]);
    },
    onError: (error) => {
      console.error('Voice error:', error);
    },
  });

  const startVoice = useCallback(async () => {
    const res = await fetch('/api/voice/signed-url');
    const { signedUrl } = await res.json();
    await conversation.startSession({ signedUrl });
  }, [conversation]);

  const endVoice = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div>
      <button onClick={startVoice} disabled={conversation.status === 'connected'}>
        Start Voice
      </button>
      <button onClick={endVoice} disabled={conversation.status === 'disconnected'}>
        End Voice
      </button>
      <p>Status: {conversation.status} | Speaking: {conversation.isSpeaking ? 'Yes' : 'No'}</p>
      <div>{messages.map((m, i) => <p key={i}>{m}</p>)}</div>
    </div>
  );
}
```

### Pattern 4: Human Passport Gate (SYBIL-01, SYBIL-02)
**What:** Use `PassportScoreWidget` and `usePassportScore` from `@human.tech/passport-embed` to gate proposal submission.
**When to use:** Proposal submission page.
**Example:**
```tsx
// dashboard/src/components/PassportGate.tsx
'use client';

import { PassportScoreWidget, usePassportScore, DarkTheme } from '@human.tech/passport-embed';
import { useState } from 'react';

interface PassportGateProps {
  children: React.ReactNode;
}

export function PassportGate({ children }: PassportGateProps) {
  const [address, setAddress] = useState<string | undefined>();

  const { score, isPassing, loading } = usePassportScore({
    apiKey: process.env.NEXT_PUBLIC_PASSPORT_API_KEY!,
    scorerId: process.env.NEXT_PUBLIC_PASSPORT_SCORER_ID!,
    address,
  });

  if (!isPassing) {
    return (
      <div>
        <h2>Verify Your Humanity</h2>
        <p>You must verify a humanity score of at least 20 to submit proposals.</p>
        <PassportScoreWidget
          apiKey={process.env.NEXT_PUBLIC_PASSPORT_API_KEY!}
          scorerId={process.env.NEXT_PUBLIC_PASSPORT_SCORER_ID!}
          address={address}
          generateSignatureCallback={async (message: string) => {
            // For hackathon demo: use a wallet connection callback
            // In production: connect to user's wallet
            return '';
          }}
          theme={DarkTheme}
          collapseMode="off"
        />
      </div>
    );
  }

  return <>{children}</>;
}
```

### Pattern 5: Solscan Explorer Links
**What:** Format Solana addresses and transaction signatures as clickable explorer links.
**When to use:** Agent identity cards, payment history, funded proposals.
**Format:**
```typescript
// Address link
const addressUrl = `https://solscan.io/address/${publicKey}?cluster=devnet`;

// Transaction link
const txUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;

// Alternative: Official Solana explorer
const explorerUrl = `https://explorer.solana.com/address/${publicKey}?cluster=devnet`;
```

### Anti-Patterns to Avoid
- **Importing backend agent classes into client components:** BaseAgent requires filesystem access (keys, addresses.json) and Solana connections. Use API routes to bridge.
- **Fetching directly from Express servers in client code:** Results in CORS issues. Proxy through Next.js API routes.
- **Embedding secret keys in NEXT_PUBLIC_ env vars:** Only public API keys (Passport API key, scorer ID) belong in NEXT_PUBLIC_. ElevenLabs API key stays server-side.
- **Building a custom voice integration:** Use `@elevenlabs/react` useConversation hook, not custom WebSocket code. The existing `voice-session.ts` pattern translates directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice conversation UI | Custom WebSocket/WebRTC code | `@elevenlabs/react` useConversation | Handles audio, connection, mic, speaking state |
| Sybil verification | Custom identity check flow | `@human.tech/passport-embed` PassportScoreWidget | Entire verification UX built-in, handles stamps |
| CSS framework | Custom styles or complex component library | Tailwind CSS utility classes | Hackathon speed; no setup beyond create-next-app |
| API data fetching | Manual fetch with state management | SWR or simple useState+useEffect | Keep it simple for hackathon; avoid Redux/Zustand overhead |
| Explorer links | Custom Solana block parsing | URL template `solscan.io/address/{key}?cluster=devnet` | Standard format, no API calls needed |

**Key insight:** This phase is purely frontend presentation. All business logic, agent coordination, and on-chain operations already exist in the backend. The dashboard just displays data and provides a UI for existing capabilities.

## Common Pitfalls

### Pitfall 1: pnpm Workspace Isolation
**What goes wrong:** Next.js inside a pnpm workspace cannot resolve dependencies from the root workspace or sibling packages without explicit configuration.
**Why it happens:** pnpm uses strict node_modules structure. Next.js expects all dependencies in its own node_modules.
**How to avoid:** Add `dashboard/` to pnpm-workspace.yaml packages list. Install all Next.js dependencies inside the dashboard workspace. For shared types, import from the root `src/` using relative paths or workspace protocol.
**Warning signs:** "Module not found" errors during build, particularly for shared types.

### Pitfall 2: Client vs Server Component Boundaries
**What goes wrong:** Using React hooks (useState, useEffect, useConversation, usePassportScore) in Server Components causes build errors.
**Why it happens:** Next.js App Router defaults to Server Components. ElevenLabs and Passport hooks require client-side execution.
**How to avoid:** Mark all interactive components with `'use client'` directive at the top. Keep API data fetching in Server Components or API routes. The VoiceWidget, PassportGate, and any stateful dashboard panel must be Client Components.
**Warning signs:** "useState is not defined" or "useEffect is not defined" build errors.

### Pitfall 3: ElevenLabs Signed URL Lifecycle
**What goes wrong:** Signed URLs expire. Starting a session with an expired URL silently fails or throws opaque errors.
**Why it happens:** ElevenLabs signed URLs have a short TTL (minutes, not hours).
**How to avoid:** Fetch the signed URL immediately before calling startSession(). Never cache it. The existing `/api/voice/signed-url` endpoint handles the ElevenLabs API call server-side.
**Warning signs:** Session connects briefly then disconnects, or "unauthorized" errors from ElevenLabs.

### Pitfall 4: Human Passport API Key Requirements
**What goes wrong:** Passport Embed requires an API key and scorer ID from the Human Passport developer portal. Without these, the widget renders nothing or shows errors.
**Why it happens:** This is a gated premium integration; credentials are required.
**How to avoid:** Register at the Human Passport developer portal early. For hackathon demo, you may need to request early access. Store credentials in `.env.local` as NEXT_PUBLIC_ vars (they are public API keys, not secrets).
**Warning signs:** Empty widget, console errors about missing API key.

### Pitfall 5: Port Conflicts Between Next.js and Express Servers
**What goes wrong:** Next.js defaults to port 3000, which may conflict. Express servers are on 4001-4003.
**Why it happens:** Multiple servers running simultaneously.
**How to avoid:** Next.js on 3000, Scout on 4001, Analyzer on 4002, Voice on 4003. Document ports. Use environment variables for configurability.
**Warning signs:** "EADDRINUSE" errors on startup.

### Pitfall 6: Wallet Connection for Passport Verification
**What goes wrong:** PassportScoreWidget requires `generateSignatureCallback` which needs a connected wallet to sign messages.
**Why it happens:** Passport verifies wallet ownership via message signing.
**How to avoid:** For hackathon demo, you can either: (a) use a minimal wallet adapter (e.g., connect to a browser wallet), or (b) provide a demo mode that simulates verification. The simplest approach is to have the `connectWalletCallback` connect to the user's browser wallet extension.
**Warning signs:** Widget shows "connect wallet" state indefinitely.

## Code Examples

Verified patterns from the existing codebase and official docs:

### Reading Agent Data Server-Side
```typescript
// Reads keys/addresses.json -- works in Next.js API routes (server-side only)
import fs from 'fs';
import path from 'path';

interface AddressesData {
  deployer: string;
  agents: Record<string, { publicKey: string; ata: string | null }>;
  usdcMint: string | null;
  isDemoUSDC: boolean;
}

function getAddresses(): AddressesData {
  // From dashboard/, addresses.json is at ../keys/addresses.json
  const filePath = path.join(process.cwd(), '..', 'keys', 'addresses.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
```

### Proxying Voice Commands via API Route
```typescript
// dashboard/src/app/api/voice/command/route.ts
import { NextRequest, NextResponse } from 'next/server';

const VOICE_SERVER = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${VOICE_SERVER}/api/voice/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

### Treasury Data Shape (from existing TreasuryBalance type)
```typescript
// What the treasury API returns -- matches src/types/proposals.ts
interface TreasuryBalance {
  solBalance: number;      // e.g., 1.5
  usdcBalance: number;     // e.g., 100.0
  totalValueUsd: number;   // e.g., 325.0
  lpPositions?: LPPosition[];
}

interface LPPosition {
  poolAddress: string;
  positionAddress: string;
  tokenX: string;
  tokenY: string;
  liquidityShare: number;
  unclaimedFees: number;
}
```

### Proposal Pipeline Status Display
```typescript
// Pipeline stages from PipelineStepEvent (src/events/event-types.ts)
type PipelineStage = 'submitted' | 'evaluating' | 'approved' | 'funded';

// Map from backend pipeline events to dashboard stages
const stageMap: Record<string, PipelineStage> = {
  'discover:started': 'submitted',
  'evaluate:started': 'evaluating',
  'evaluate:completed': 'approved',  // if recommendation is 'fund'
  'fund:completed': 'funded',
};
```

### x402 Payment History Entry
```typescript
// Payment record for dashboard display
interface PaymentRecord {
  timestamp: number;
  from: string;        // Agent role (e.g., 'governance')
  to: string;          // Agent role (e.g., 'scout')
  amount: number;      // USDC amount
  service: string;     // What was paid for (e.g., 'proposal discovery')
  txSignature: string; // Solana transaction signature
  txUrl: string;       // Solscan link
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router | App Router | Next.js 13+ (2023) | Server Components, nested layouts, API route handlers |
| @11labs/react | @elevenlabs/react | 2024 | Rebranded package, same useConversation API |
| Gitcoin Passport | Human Passport (human.tech) | 2025 | Rebranded from Gitcoin; @human.tech/passport-embed package |
| Tailwind v3 | Tailwind v4 | 2025 | Simplified config, CSS-first approach |
| Custom wallet adapters | PassportScoreWidget built-in | 2025 | Widget handles wallet connection internally |

**Deprecated/outdated:**
- `@gitcoin/passport-sdk`: Replaced by `@human.tech/passport-embed`
- `@11labs/react`: Replaced by `@elevenlabs/react` (same API)
- Pages Router with `getServerSideProps`: Use App Router with Server Components

## Open Questions

1. **Human Passport API Key Availability**
   - What we know: Passport Embed requires an API key and scorer ID from the developer portal
   - What's unclear: Whether instant signup is available or if there is a waitlist/approval process
   - Recommendation: Register early. For hackathon demo, have a fallback mock that simulates verification (show the widget but allow bypass with a demo flag)

2. **Wallet Connection for Passport**
   - What we know: PassportScoreWidget requires generateSignatureCallback for wallet ownership verification
   - What's unclear: Whether a minimal approach (browser wallet) is sufficient or if more setup is needed
   - Recommendation: Use the simplest wallet connection possible. For hackathon, a demo mode that bypasses wallet signing may be acceptable since the judges want to see the integration, not production security

3. **Real-time Data vs Polling**
   - What we know: Backend has TypedEventBus for real-time events, but no WebSocket server
   - What's unclear: Whether polling (every 5-10 seconds) is sufficient for the demo
   - Recommendation: Use polling with setInterval for treasury and pipeline data. Real-time updates are a v2 concern (ADVCO-02). Polling is simple, reliable, and sufficient for a 5-minute demo

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts (root) -- dashboard may need separate config |
| Quick run command | `pnpm test --filter dashboard` |
| Full suite command | `pnpm test` (root, runs all workspace tests) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Agent identities API returns 4 agents with Solscan links | unit | `pnpm vitest run tests/unit/dashboard-agents-api.test.ts -x` | No -- Wave 0 |
| DASH-02 | Treasury API returns balance, LP positions | unit | `pnpm vitest run tests/unit/dashboard-treasury-api.test.ts -x` | No -- Wave 0 |
| DASH-03 | Proposal pipeline renders stages | unit | `pnpm vitest run tests/unit/dashboard-proposals.test.ts -x` | No -- Wave 0 |
| DASH-04 | Voice widget connects via signed URL | manual-only | Manual: start voice server, open dashboard, click Start Voice | N/A |
| DASH-05 | Payment history displays x402 records | unit | `pnpm vitest run tests/unit/dashboard-payments.test.ts -x` | No -- Wave 0 |
| SYBIL-01 | Passport widget renders and gates content | manual-only | Manual: load /submit, verify widget renders | N/A |
| SYBIL-02 | Unverified users blocked from submission | unit | `pnpm vitest run tests/unit/passport-gate.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (root, all workspace tests)
- **Per wave merge:** `pnpm test` + manual dashboard smoke test
- **Phase gate:** All unit tests green + manual verification of dashboard pages

### Wave 0 Gaps
- [ ] Dashboard workspace setup with its own test configuration
- [ ] `tests/unit/dashboard-agents-api.test.ts` -- API route returns 4 agents with correct Solscan links
- [ ] `tests/unit/dashboard-treasury-api.test.ts` -- Treasury proxy returns TreasuryBalance shape
- [ ] `tests/unit/dashboard-proposals.test.ts` -- Pipeline stage mapping logic
- [ ] `tests/unit/dashboard-payments.test.ts` -- Payment history data shape
- [ ] `tests/unit/passport-gate.test.ts` -- Gate blocks when isPassing is false, allows when true

Note: DASH-04 (voice widget) and SYBIL-01 (Passport widget rendering) are manual-only because they depend on external services (ElevenLabs WebSocket, Human Passport API) and browser audio/wallet capabilities that cannot be unit tested meaningfully.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/agents/types.ts`, `src/types/proposals.ts`, `src/events/event-types.ts` -- all data interfaces
- Existing codebase: `src/voice/voice-server.ts`, `src/voice/voice-tools.ts` -- voice server API
- Existing codebase: `src/agents/treasury-agent.ts` -- TreasuryBalance, LPPosition types
- Existing codebase: `keys/addresses.json` -- agent identity data structure
- [Human Passport Embed Component Reference](https://docs.passport.xyz/building-with-passport/embed/component-reference) -- PassportScoreWidget props, usePassportScore hook
- [Human Passport Embed Introduction](https://docs.passport.xyz/building-with-passport/embed/introduction) -- setup prerequisites
- [ElevenLabs React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react) -- useConversation hook, startSession, clientTools

### Secondary (MEDIUM confidence)
- [Passport Embed Blog Post](https://passport.human.tech/blog/passport-embed-is-live-bring-privacy-preserving-proof-of-humanity-directly-into-your-dapp-or-website) -- general availability confirmation
- [Next.js Installation Docs](https://nextjs.org/docs/app/getting-started/installation) -- create-next-app CLI options
- [pnpm Workspaces](https://pnpm.io/next/workspaces) -- workspace configuration

### Tertiary (LOW confidence)
- Passport Embed API key availability -- may require developer portal approval (unverified wait time)
- @human.tech/passport-embed exact version -- "latest" used, specific version unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js, ElevenLabs React, Tailwind are well-documented; Human Passport Embed docs verified
- Architecture: HIGH - All backend data sources exist and interfaces are typed; dashboard is pure presentation layer
- Pitfalls: HIGH - Common Next.js workspace and client/server boundary issues are well-documented
- Sybil integration: MEDIUM - Passport Embed API is documented but API key provisioning process is unverified

**Research date:** 2026-03-14
**Valid until:** 2026-03-21 (7 days -- hackathon-scoped, fast-moving SDKs)
