/**
 * Singleton web3.js Connection for all Solana operations.
 *
 * Provides a shared Connection instance connected to Solana devnet.
 * No Umi types are imported here -- web3.js only.
 */

import 'dotenv/config';
import { Connection } from '@solana/web3.js';

let _connection: Connection | null = null;

/**
 * Get or create the shared Connection instance.
 * Connects to Solana devnet by default, configurable via SOLANA_RPC_URL.
 */
export function getConnection(): Connection {
  if (!_connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    _connection = new Connection(rpcUrl, 'confirmed');
  }
  return _connection;
}

/**
 * Reset the connection instance (useful for testing).
 */
export function resetConnection(): void {
  _connection = null;
}
