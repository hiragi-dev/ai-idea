import { callAgent, runWithConcurrency } from '../llm.js';
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

export async function runExplorers(
  problem: ProblemSpec,
  progressKey?: string
): Promise<GeneratedIdea[][]> {
  const baseVariables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    existing_ideas: JSON.stringify(problem.existing_ideas, null, 2),
    seed_ideas: JSON.stringify(problem.seed_ideas ?? [], null, 2),
    count: '1',
  };

  const count = CONFIG.explorer.countPerAgent;
  const tasks = EXPLORER_NAMES.flatMap((name, explorerIndex) =>
    Array.from({ length: count }, () => ({ name, explorerIndex }))
  );

  const results = await runWithConcurrency(
    tasks,
    CONFIG.concurrency.llm,
    async (task) => {
      const response = await callAgent(
        task.name,
        baseVariables,
        ExplorerOutputSchema,
        { progressKey }
      );
      return { explorerIndex: task.explorerIndex, ideas: response.ideas };
    }
  );

  const outputs: GeneratedIdea[][] = EXPLORER_NAMES.map(() => []);
  for (const result of results) {
    outputs[result.explorerIndex].push(...result.ideas);
  }
  return outputs;
}
