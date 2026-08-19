import { callAgent, runWithConcurrency } from '../llm.js';
import { RedTeamOutputSchema } from '../schemas.js';
import { CONFIG } from '../config.js';
import type { ProblemSpec, Idea } from '../types.js';

export type KillResult = { gate: string; reason: string };

export async function runKillGates(
  problem: ProblemSpec,
  ideas: Idea[],
  progressKey?: string
): Promise<Map<string, KillResult[]>> {
  const baseVars: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
  };

  const results = await runWithConcurrency(ideas, CONFIG.concurrency.llm, async (idea) => {
    const response = await callAgent(
      'redteam',
      { ...baseVars, idea: JSON.stringify(idea, null, 2) },
      RedTeamOutputSchema,
      { progressKey }
    );
    const kills = response.kills.filter((k) => k.killed).map((k) => ({ gate: k.gate, reason: k.reason }));
    return { ideaId: idea.id, kills };
  });

  const map = new Map<string, KillResult[]>();
  for (const result of results) {
    map.set(result.ideaId, result.kills);
  }
  return map;
}
