import { callAgent } from '../llm.js';
import { ExplorerOutputSchema } from '../schemas.js';
import { CONFIG } from '../config.js';
import type { ProblemSpec, GeneratedIdea } from '../types.js';

const EXPLORER_NAMES = [
  'explorer_pain',
  'explorer_anti_agent',
  'explorer_interaction',
  'explorer_counterfactual',
  'explorer_demo',
] as const;

export async function runExplorers(problem: ProblemSpec): Promise<GeneratedIdea[][]> {
  const variables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    existing_ideas: JSON.stringify(problem.existing_ideas, null, 2),
    seed_ideas: JSON.stringify(problem.seed_ideas ?? [], null, 2),
    count: String(CONFIG.explorer.countPerAgent),
  };

  const outputs = await Promise.all(
    EXPLORER_NAMES.map(async (name) => {
      const response = await callAgent(name, variables, ExplorerOutputSchema);
      return response.ideas;
    })
  );

  return outputs;
}
