/**
 * Unit tests for the Passport gating logic.
 *
 * Tests the shouldAllowSubmission pure function that determines
 * whether a user passes the sybil resistance gate.
 */

import { describe, it, expect } from 'vitest';
import { shouldAllowSubmission } from '../../dashboard/src/lib/passport-utils.js';

describe('shouldAllowSubmission', () => {
  // --- Production mode tests (demoMode = false) ---

  it('allows when score >= 20 and isPassing is true', () => {
    expect(shouldAllowSubmission(25, true, false)).toBe(true);
  });

  it('allows at exact threshold (score = 20, isPassing true)', () => {
    expect(shouldAllowSubmission(20, true, false)).toBe(true);
  });

  it('blocks when score < 20 and isPassing is false', () => {
    expect(shouldAllowSubmission(15, false, false)).toBe(false);
  });

  it('blocks when score is null (loading)', () => {
    expect(shouldAllowSubmission(null, false, false)).toBe(false);
  });

  it('blocks when score >= 20 but isPassing is false (API disagreement)', () => {
    expect(shouldAllowSubmission(25, false, false)).toBe(false);
  });

  it('blocks when score is 0', () => {
    expect(shouldAllowSubmission(0, false, false)).toBe(false);
  });

  // --- Demo mode tests (demoMode = true) ---

  it('blocks in demo mode when score is null (user has not clicked simulate)', () => {
    expect(shouldAllowSubmission(null, false, true)).toBe(false);
  });

  it('allows in demo mode with simulated score >= 20', () => {
    expect(shouldAllowSubmission(25, true, true)).toBe(true);
  });

  it('blocks in demo mode with simulated score < 20', () => {
    expect(shouldAllowSubmission(10, false, true)).toBe(false);
  });

  it('allows in demo mode at exact threshold (score = 20)', () => {
    expect(shouldAllowSubmission(20, true, true)).toBe(true);
  });

  it('blocks in demo mode with score 19 (just below threshold)', () => {
    expect(shouldAllowSubmission(19, false, true)).toBe(false);
  });
});
