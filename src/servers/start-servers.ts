/**
 * Start both Scout and Analyzer x402-gated HTTP servers.
 *
 * Usage: npx tsx src/servers/start-servers.ts
 *
 * Handles SIGINT/SIGTERM for graceful shutdown.
 */

import type { Server } from 'http';
import { createScoutServer } from './scout-server.js';
import { createAnalyzerServer } from './analyzer-server.js';

async function main() {
  const servers: Server[] = [];

  console.log('Starting x402 agent servers...\n');

  // Start Scout server
  const scout = createScoutServer();
  const scoutServer = await scout.start();
  servers.push(scoutServer);
  const scoutAddr = scoutServer.address();
  const scoutPort = typeof scoutAddr === 'object' && scoutAddr ? scoutAddr.port : 4001;
  console.log(`Scout server listening on http://localhost:${scoutPort}`);
  console.log(`  GET /discover (x402-gated, 0.001 USDC)`);
  console.log(`  GET /health\n`);

  // Start Analyzer server
  const analyzer = createAnalyzerServer();
  const analyzerServer = await analyzer.start();
  servers.push(analyzerServer);
  const analyzerAddr = analyzerServer.address();
  const analyzerPort = typeof analyzerAddr === 'object' && analyzerAddr ? analyzerAddr.port : 4002;
  console.log(`Analyzer server listening on http://localhost:${analyzerPort}`);
  console.log(`  POST /evaluate (x402-gated, 0.002 USDC)`);
  console.log(`  GET /health\n`);

  console.log('Both servers running. Press Ctrl+C to stop.');

  // Graceful shutdown
  function shutdown() {
    console.log('\nShutting down servers...');
    let closed = 0;
    for (const server of servers) {
      server.close(() => {
        closed++;
        if (closed === servers.length) {
          console.log('All servers stopped.');
          process.exit(0);
        }
      });
    }
    // Force exit after 5 seconds
    setTimeout(() => {
      console.error('Force shutdown after timeout.');
      process.exit(1);
    }, 5000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start servers:', err);
  process.exit(1);
});
