import { callAgent, runWithConcurrency } from '../llm.js';
import { SeedProcessorOutputSchema } from '../schemas.js';
import { CONFIG } from '../config.js';
import type { ProblemSpec, GeneratedIdea } from '../types.js';

export async function processSeeds(
  problem: ProblemSpec
): Promise<GeneratedIdea[]> {
  const seeds = problem.seed_ideas ?? [];
  if (seeds.length === 0) return [];

  const baseVars: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
  };

  return runWithConcurrency(seeds, CONFIG.concurrency.llm, async (seed) => {
    const response = await callAgent(
      'seed_processor',
      { ...baseVars, seed },
      SeedProcessorOutputSchema
    );
    return response.idea;
  });
}
