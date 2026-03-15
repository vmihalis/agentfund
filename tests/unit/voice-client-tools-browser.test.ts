/**
 * Tests for browser-side clientTools factory (createBrowserClientTools).
 *
 * Verifies that:
 * - createBrowserClientTools returns an object with exactly 4 tool keys
 * - findProposals calls sendCommand with the query text and returns result.message
 * - analyzeProposal calls sendCommand with "analyze proposal {id}" and returns result.message
 * - fundProject calls sendCommand with "fund {id} {amount}" (or "fund {id}" without amount) and returns result.message
 * - checkTreasury calls sendCommand with "check treasury" and returns result.message
 *
 * All sendCommand calls are mocked via vi.fn().
 */

import { describe, it, expect, vi } from 'vitest';
import { createBrowserClientTools } from '../../dashboard/src/components/VoiceWidget';

describe('createBrowserClientTools', () => {
  const mockSendCommand = vi.fn();

  function setup() {
    mockSendCommand.mockReset();
    mockSendCommand.mockResolvedValue({ message: 'test response' });
    return createBrowserClientTools(mockSendCommand);
  }

  it('returns object with exactly 4 tool keys', () => {
    const tools = setup();
    const keys = Object.keys(tools);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('findProposals');
    expect(keys).toContain('analyzeProposal');
    expect(keys).toContain('fundProject');
    expect(keys).toContain('checkTreasury');
  });

  it('findProposals calls sendCommand with query and returns message string', async () => {
    const tools = setup();
    const result = await tools.findProposals({ query: 'solana grants' });

    expect(mockSendCommand).toHaveBeenCalledWith('solana grants');
    expect(result).toBe('test response');
    expect(typeof result).toBe('string');
  });

  it('analyzeProposal calls sendCommand with "analyze proposal {id}" and returns message', async () => {
    const tools = setup();
    const result = await tools.analyzeProposal({ proposalId: 'prop-1' });

    expect(mockSendCommand).toHaveBeenCalledWith('analyze proposal prop-1');
    expect(result).toBe('test response');
    expect(typeof result).toBe('string');
  });

  it('fundProject with amount calls sendCommand with "fund {id} {amount}"', async () => {
    const tools = setup();
    const result = await tools.fundProject({ proposalId: 'prop-1', amount: '5000' });

    expect(mockSendCommand).toHaveBeenCalledWith('fund prop-1 5000');
    expect(result).toBe('test response');
    expect(typeof result).toBe('string');
  });

  it('fundProject without amount calls sendCommand with "fund {id}"', async () => {
    const tools = setup();
    const result = await tools.fundProject({ proposalId: 'prop-1' });

    expect(mockSendCommand).toHaveBeenCalledWith('fund prop-1');
    expect(result).toBe('test response');
  });

  it('checkTreasury calls sendCommand with "check treasury" and returns message', async () => {
    const tools = setup();
    const result = await tools.checkTreasury();

    expect(mockSendCommand).toHaveBeenCalledWith('check treasury');
    expect(result).toBe('test response');
    expect(typeof result).toBe('string');
  });
});
