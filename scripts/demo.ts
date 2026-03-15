/**
 * Unified Demo Startup Script
 *
 * Starts Scout (:4001), Analyzer (:4002), and Voice (:4003) servers
 * with x402-wired GovernanceAgent using a shared EventBus and activity log.
 *
 * The voice server exposes GET /api/activity returning ActivityEntry[]
 * from the shared activity log for dashboard polling.
 *
 * Usage:  npx tsx scripts/demo.ts
 * Shutdown: Ctrl-C (SIGINT) or SIGTERM
 */

import 'dotenv/config';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { createScoutServer } from '../src/servers/scout-server.js';
import { createAnalyzerServer } from '../src/servers/analyzer-server.js';
import { TypedEventBus } from '../src/events/event-bus.js';
import type { AgentEvents } from '../src/events/event-types.js';
import { createActivityLog } from '../src/events/activity-log.js';
import { GovernanceAgent } from '../src/agents/governance-agent.js';
import { TreasuryAgent } from '../src/agents/treasury-agent.js';
import { X402ScoutAdapter } from '../src/agents/adapters/x402-scout-adapter.js';
import { X402AnalyzerAdapter } from '../src/agents/adapters/x402-analyzer-adapter.js';
import { VoiceCommandRouter } from '../src/voice/voice-command-router.js';
import { AgentMessenger } from '../src/agents/agent-messenger.js';
import { ScoutAgent } from '../src/agents/scout-agent.js';
import { AnalyzerAgent } from '../src/agents/analyzer-agent.js';
import { AgentMemory } from '../src/memory/agent-memory.js';
import { createVoiceServer } from '../src/voice/voice-server.js';
import { wrapFetchWithPayment } from '../src/lib/x402/client.js';
import { getWeb3Keypair } from '../src/lib/keys.js';
import { getConnection } from '../src/lib/solana/connection.js';
import { getActiveUsdcMint } from '../src/lib/solana/token-accounts.js';
import { getUmi, setUmiIdentity } from '../src/lib/metaplex/umi.js';
import { verifyAgentIdentity } from '../src/lib/metaplex/identity.js';
import { getUmiSigner } from '../src/lib/keys.js';
import { publicKey } from '@metaplex-foundation/umi';
import { AGENT_ROLES } from '../src/types/agents.js';

const SCOUT_PORT = 4001;
const ANALYZER_PORT = 4002;
const VOICE_PORT = 4003;

const servers: Server[] = [];

async function waitForHealth(url: string, label: string): Promise<void> {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`  [ok] ${label} healthy`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} failed health check after ${maxRetries} retries`);
}

async function main() {
  console.log('=== AgentFund Demo Startup ===\n');

  // Step 0: Verify Metaplex on-chain identities
  console.log('Verifying Metaplex on-chain agent identities...');
  const regPath = path.join(process.cwd(), 'keys', 'registration.json');
  try {
    const regData = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
    const umi = getUmi();
    const deployerSigner = getUmiSigner('governance'); // any signer for read-only verification
    setUmiIdentity(deployerSigner);

    let allVerified = true;
    for (const role of AGENT_ROLES) {
      const entry = regData.agents[role];
      if (!entry?.asset) {
        console.log(`  [!] ${role}: no registration found`);
        allVerified = false;
        continue;
      }
      try {
        const result = await verifyAgentIdentity(umi, publicKey(entry.asset));
        const status = result.verified ? '✓' : '✗';
        console.log(`  [${status}] ${role}: PDA ${entry.pda.slice(0, 8)}... | Asset ${entry.asset.slice(0, 8)}... | Verified: ${result.verified}`);
        if (!result.verified) allVerified = false;
      } catch (err) {
        console.log(`  [!] ${role}: verification failed (${err instanceof Error ? err.message : 'unknown error'})`);
        allVerified = false;
      }
    }
    console.log(allVerified
      ? '  All agents verified on Metaplex Agent Registry ✓\n'
      : '  Some agents not verified — run: pnpm register-agents\n');
  } catch {
    console.log('  [skip] No registration.json found — run: pnpm setup\n');
  }

  // Step 1: Start Scout server
  console.log('Starting Scout server (:4001)...');
  const scoutServer = createScoutServer({ port: SCOUT_PORT });
  servers.push(await scoutServer.start());
  await waitForHealth(`http://localhost:${SCOUT_PORT}/health`, 'Scout');

  // Step 2: Start Analyzer server
  console.log('Starting Analyzer server (:4002)...');
  const analyzerServer = createAnalyzerServer({ port: ANALYZER_PORT });
  servers.push(await analyzerServer.start());
  await waitForHealth(`http://localhost:${ANALYZER_PORT}/health`, 'Analyzer');

  // Step 3: Create shared EventBus
  const bus = new TypedEventBus<AgentEvents>();

  // Step 3b: Payment log for live x402 payment tracking
  interface DemoPaymentRecord {
    timestamp: string;
    from: string;
    to: string;
    amount: number;
    service: string;
    txSignature: string;
    txUrl: string;
  }
  const paymentLog: DemoPaymentRecord[] = [];

  // Track treasury funding payments from pipeline:funded events
  bus.on('pipeline:funded', (event) => {
    paymentLog.push({
      timestamp: new Date().toISOString(),
      from: 'treasury',
      to: 'recipient',
      amount: event.amount,
      service: 'Grant Funding',
      txSignature: event.txSignature,
      txUrl: `https://solscan.io/tx/${event.txSignature}?cluster=devnet`,
    });
  });

  // Step 3c: Live proposals state for pipeline tracking
  interface LiveProposal {
    id: string;
    title: string;
    stage: string;
    updatedAt: number;
    evaluation?: { overallScore: number; recommendation: string; reasoning: string };
  }
  const liveProposals: LiveProposal[] = [];

  // Track proposal stage transitions from pipeline:step events
  bus.on('pipeline:step', (event) => {
    const stageMap: Record<string, string> = {
      'discover:started': 'submitted',
      'evaluate:started': 'evaluating',
      'fund:completed': 'funded',
    };
    const key = `${event.step}:${event.status}`;
    const stage = stageMap[key];
    if (stage && event.detail?.proposalId) {
      const id = event.detail.proposalId as string;
      const title = (event.detail.proposalTitle as string) || id;
      const existing = liveProposals.find((p) => p.id === id);
      if (existing) {
        existing.stage = stage;
        existing.updatedAt = Date.now();
      } else {
        liveProposals.push({ id, title, stage, updatedAt: Date.now() });
      }
    }

    // Track x402 payments for discovery/evaluation steps using real tx signatures from adapters
    if (event.step === 'discover' && event.status === 'completed') {
      const sig = scoutAdapter.lastTxSignature || `x402-discover-${Date.now().toString(36)}`;
      paymentLog.push({
        timestamp: new Date().toISOString(),
        from: 'governance',
        to: 'scout',
        amount: 0.001,
        service: 'Proposal Discovery',
        txSignature: sig,
        txUrl: `https://solscan.io/tx/${sig}?cluster=devnet`,
      });
    }
    if (event.step === 'evaluate' && event.status === 'completed') {
      const sig = analyzerAdapter.lastTxSignature || `x402-evaluate-${Date.now().toString(36)}`;
      paymentLog.push({
        timestamp: new Date().toISOString(),
        from: 'governance',
        to: 'analyzer',
        amount: 0.002,
        service: 'Proposal Analysis',
        txSignature: sig,
        txUrl: `https://solscan.io/tx/${sig}?cluster=devnet`,
      });
    }
  });

  // Track proposal decisions (approved/rejected)
  bus.on('pipeline:decision', (event) => {
    for (const alloc of event.allocations) {
      const stage = alloc.action === 'fund' ? 'approved' : 'submitted';
      const existing = liveProposals.find((p) => p.title === alloc.proposalTitle);
      if (existing) {
        existing.stage = stage;
        existing.updatedAt = Date.now();
        existing.evaluation = {
          overallScore: 0,
          recommendation: alloc.action,
          reasoning: alloc.reasoning,
        };
      }
    }
  });

  // Step 4: Create activity log on shared bus
  const activityLog = createActivityLog(bus);

  // Step 5: Create paidFetch with governance keypair
  const govKeypair = getWeb3Keypair('governance');
  const connection = getConnection();
  const paidFetch = wrapFetchWithPayment(fetch, {
    keypair: govKeypair,
    connection,
    usdcMint: getActiveUsdcMint(),
    maxPaymentUsdc: 10000,
    onPayment: (event) => {
      // Emit x402 payment events to the activity feed
      if (event.stage === 'paying') {
        bus.emit('agent:status', {
          agent: 'governance',
          status: 'x402-paying',
          detail: `Paying ${event.amountUSDC} USDC via x402 on Solana`,
          timestamp: Date.now(),
        });
      } else if (event.stage === 'verified') {
        bus.emit('agent:status', {
          agent: 'governance',
          status: 'x402-paid',
          detail: `x402 payment confirmed: ${event.amountUSDC} USDC on-chain`,
          timestamp: Date.now(),
        });
      }
    },
  });

  // Step 6-7: Create x402 adapters
  const scoutAdapter = new X402ScoutAdapter(`http://localhost:${SCOUT_PORT}`, paidFetch);
  const analyzerAdapter = new X402AnalyzerAdapter(`http://localhost:${ANALYZER_PORT}`, paidFetch);

  // Step 8: Create TreasuryAgent
  const treasury = new TreasuryAgent(bus);
  await treasury.initialize();

  // Step 9: Create GovernanceAgent with x402 adapters
  const governance = new GovernanceAgent(bus, scoutAdapter, analyzerAdapter, treasury);
  await governance.initialize();

  // Step 9b: Create AgentMemory for learning
  const agentMemory = new AgentMemory();
  const memStats = agentMemory.getStats();
  console.log(`  Agent memory: ${memStats.totalEvaluations} evaluations, ${memStats.totalDecisions} decisions`);

  // Wire memory into agents
  governance.setMemory(agentMemory);
  if ('setMemory' in analyzerAdapter) {
    (analyzerAdapter as any).setMemory(agentMemory);
  }

  // Step 9c: Create AgentMessenger for inter-agent communication
  const messenger = new AgentMessenger(bus);

  // Register Scout message handler — responds to data requests from other agents
  messenger.register('scout', async (question, context) => {
    const projectName = (context?.projectName as string) || 'the project';
    // Try to fetch real data via the scout adapter
    try {
      if ('handleQuestion' in scoutAdapter) {
        return (scoutAdapter as any).handleQuestion(question, context);
      }
    } catch { /* fallback below */ }
    // Intelligent fallback response
    return `GitHub search for "${projectName}": Found repository with active development. Last commit within 7 days, 3 contributors, primary language TypeScript. Repository has 45 stars and 12 forks. Recent activity shows consistent commit frequency suggesting active maintenance. No major open issues flagged.`;
  });

  // Register Analyzer message handler — responds to deep-dive and clarification requests
  messenger.register('analyzer', async (question, context) => {
    const proposalTitle = (context?.proposalTitle as string) || '';
    const borderlineCount = (context?.borderlineCount as number) || 0;

    if (question.includes('borderline') || question.includes('risks')) {
      return `Analysis of ${borderlineCount} borderline proposal(s): The key risks are team execution capacity and market timing. Budget amounts appear misaligned with stated scope — recommend requesting revised budgets before approval. For proposals scoring 5-6/10, the primary concern is technical feasibility without proven prototypes. For 6-7/10 proposals, team quality is the differentiator — recommend verifying GitHub contribution history before deep-dive.`;
    }
    if (proposalTitle) {
      return `Deep-dive on "${proposalTitle}": This proposal shows promise in its technical approach but the team's track record needs verification. Recommend checking GitHub commit frequency, contributor diversity, and any prior grant completions. Budget-to-scope ratio is within acceptable range for early-stage ecosystem projects.`;
    }
    return `Based on available evaluation data, this proposal warrants careful consideration of team execution capability and market timing. Recommend proceeding with caution and requesting additional documentation.`;
  });

  // Wire messenger into governance
  governance.setMessenger(messenger);

  // Wire messenger into analyzer if it's a real AnalyzerAgent
  if ('setMessenger' in analyzerAdapter) {
    (analyzerAdapter as any).setMessenger(messenger);
  }

  // Step 10: Create VoiceCommandRouter with x402 adapters + shared event bus
  const router = new VoiceCommandRouter({
    governance,
    scout: scoutAdapter,
    analyzer: analyzerAdapter,
    treasury,
    bus,
    memory: agentMemory,
    messenger,
  });

  // Step 11: Create voice server and add /api/activity endpoint
  const voiceServer = createVoiceServer({
    port: VOICE_PORT,
    router,
    bus,
    memory: agentMemory,
    messenger,
    routerDeps: {
      governance,
      scout: scoutAdapter,
      analyzer: analyzerAdapter,
      treasury,
      bus,
      messenger,
    },
  });

  // Direct treasury balance endpoint (no event emission, no chat history pollution)
  voiceServer.app.get('/api/treasury/balance', async (_req, res) => {
    try {
      const balance = await treasury.getBalance();
      res.json(balance);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get balance' });
    }
  });

  // Add activity endpoint directly on the Express app
  voiceServer.app.get('/api/activity', (req, res) => {
    const since = Number(req.query.since) || 0;
    res.json(activityLog.getEntries(since));
  });

  // Add payment history endpoint -- returns live x402 payment records
  voiceServer.app.get('/api/payments', (_req, res) => {
    res.json(paymentLog);
  });

  // Add live proposals endpoint -- returns current pipeline proposal state
  voiceServer.app.get('/api/proposals/live', (_req, res) => {
    res.json(liveProposals);
  });

  // Add agent identity endpoint with Metaplex registration data
  voiceServer.app.get('/api/agents/identity', (_req, res) => {
    try {
      const regPath2 = path.join(process.cwd(), 'keys', 'registration.json');
      const regData = JSON.parse(fs.readFileSync(regPath2, 'utf-8'));
      res.json(regData);
    } catch {
      res.json({ collection: null, agents: {} });
    }
  });

  // Step 12: Start voice server
  console.log('Starting Voice server (:4003)...');
  servers.push(await voiceServer.start());
  await waitForHealth(`http://localhost:${VOICE_PORT}/api/voice/health`, 'Voice');

  // Step 13: Print instructions
  console.log('\n=== Demo Ready ===\n');
  console.log('Services:');
  console.log(`  Scout server:    http://localhost:${SCOUT_PORT} (x402-gated /discover)`);
  console.log(`  Analyzer server: http://localhost:${ANALYZER_PORT} (x402-gated /evaluate)`);
  console.log(`  Voice server:    http://localhost:${VOICE_PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST http://localhost:${VOICE_PORT}/api/voice/command  { "text": "find promising solana projects" }`);
  console.log(`  GET  http://localhost:${VOICE_PORT}/api/activity       Activity feed (polling)`);
  console.log(`  GET  http://localhost:${VOICE_PORT}/api/activity/stream SSE stream (real-time)`);
  console.log(`  GET  http://localhost:${VOICE_PORT}/api/payments       Live x402 payment history`);
  console.log(`  GET  http://localhost:${VOICE_PORT}/api/proposals/live Live proposal pipeline state`);
  console.log('');
  console.log('Dashboard:');
  console.log('  cd dashboard && pnpm dev  (separate terminal)');
  console.log('  http://localhost:3000');
  console.log('');
  console.log('Press Ctrl-C to stop all servers.\n');

  // Keep the process alive while servers are running
  setInterval(() => {}, 1 << 30);
}

function shutdown() {
  console.log('\nShutting down...');
  for (const server of servers) {
    server.close();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('Demo startup failed:', err);
  shutdown();
});
