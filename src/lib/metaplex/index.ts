/**
 * Metaplex module public API.
 *
 * Re-exports function-level API from sub-modules.
 * Umi types are NOT re-exported -- callers use Umi types directly
 * from @metaplex-foundation/umi if needed (only within src/lib/metaplex/).
 */

export { getUmi, setUmiIdentity, resetUmi } from './umi.js';
export { createAgentCollection, fetchAgentCollection } from './collection.js';
export { createAgentAsset, fetchAgentAsset } from './agent-nft.js';
export type { CreateAgentAssetArgs } from './agent-nft.js';
export {
  registerAgentIdentity,
  isAgentRegistered,
  verifyAgentIdentity,
} from './identity.js';
export type { RegisterAgentIdentityArgs, VerificationResult } from './identity.js';
