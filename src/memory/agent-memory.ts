/**
 * AgentMemory -- JSON-file-based persistent memory for agent learning.
 *
 * Stores evaluation outcomes, funding decisions, and results to enable
 * calibration (historical score distributions) and precedent-aware decisions.
 * Persists to data/agent-memory.json.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'evaluation' | 'decision' | 'outcome';
  proposalId: string;
  proposalTitle: string;
  data: Record<string, unknown>;
}

export interface MemoryStats {
  totalEvaluations: number;
  totalDecisions: number;
  avgScore: number;
}

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'agent-memory.json');

export class AgentMemory {
  private entries: MemoryEntry[] = [];
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_PATH;
    this.load();
  }

  /** Load entries from disk. */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.entries = JSON.parse(raw) as MemoryEntry[];
      }
    } catch {
      this.entries = [];
    }
  }

  /** Persist entries to disk. */
  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
    } catch (err) {
      console.error(`[AgentMemory] Failed to persist: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Save a new memory entry. */
  save(entry: Omit<MemoryEntry, 'id'>): void {
    const full: MemoryEntry = { id: randomUUID(), ...entry };
    this.entries.push(full);
    // Cap at 1000 entries
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000);
    }
    this.persist();
  }

  /** Query entries with optional filters. */
  query(filter?: { type?: MemoryEntry['type']; since?: number; proposalTitle?: string }): MemoryEntry[] {
    let results = this.entries;
    if (filter?.type) {
      results = results.filter(e => e.type === filter.type);
    }
    if (filter?.since) {
      results = results.filter(e => e.timestamp > filter.since!);
    }
    if (filter?.proposalTitle) {
      const search = filter.proposalTitle.toLowerCase();
      results = results.filter(e => e.proposalTitle.toLowerCase().includes(search));
    }
    return results;
  }

  /** Get score distribution statistics from past evaluations. */
  getScoreDistribution(): { mean: number; stddev: number; count: number } {
    const evaluations = this.entries.filter(e => e.type === 'evaluation');
    if (evaluations.length === 0) return { mean: 0, stddev: 0, count: 0 };

    const scores = evaluations.map(e => (e.data.overallScore as number) ?? 0).filter(s => s > 0);
    if (scores.length === 0) return { mean: 0, stddev: 0, count: 0 };

    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const stddev = Math.sqrt(variance);

    return { mean: Math.round(mean * 100) / 100, stddev: Math.round(stddev * 100) / 100, count: scores.length };
  }

  /** Find similar past decisions by fuzzy title matching. */
  getSimilarDecisions(title: string, _description?: string): MemoryEntry[] {
    const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return this.entries
      .filter(e => e.type === 'decision' || e.type === 'evaluation')
      .filter(e => {
        const entryTitle = e.proposalTitle.toLowerCase();
        return words.some(w => entryTitle.includes(w));
      })
      .slice(-5); // Last 5 similar
  }

  /** Get memory statistics for the dashboard. */
  getStats(): MemoryStats {
    const evaluations = this.entries.filter(e => e.type === 'evaluation');
    const decisions = this.entries.filter(e => e.type === 'decision');
    const scores = evaluations
      .map(e => (e.data.overallScore as number) ?? 0)
      .filter(s => s > 0);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100
      : 0;

    return {
      totalEvaluations: evaluations.length,
      totalDecisions: decisions.length,
      avgScore,
    };
  }

  /** Get last N decisions for governance context. */
  getRecentDecisions(n = 10): MemoryEntry[] {
    return this.entries
      .filter(e => e.type === 'decision')
      .slice(-n);
  }
}
