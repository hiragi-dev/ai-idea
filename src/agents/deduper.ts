import { callAgent } from '../llm.js';
import { DeduperOutputSchema } from '../schemas.js';
import type { ProblemSpec, Idea, DedupedIdea } from '../types.js';

export async function dedupe(
  problem: ProblemSpec,
  ideas: Idea[],
  targetCount?: number
): Promise<DedupedIdea[]> {
  const variables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    ideas: JSON.stringify(ideas, null, 2),
    target_count: String(targetCount ?? Math.max(1, Math.ceil(ideas.length / 2))),
  };

  const response = await callAgent('deduper', variables, DeduperOutputSchema);
  return response.ideas;
}
