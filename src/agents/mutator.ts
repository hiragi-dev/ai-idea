import { callAgent } from '../llm.js';
import { MutationOutputSchema } from '../schemas.js';
import type { ProblemSpec, Idea, GeneratedIdea, MutationInstruction } from '../types.js';

export async function mutateIdea(
  problem: ProblemSpec,
  idea: Idea,
  instruction: MutationInstruction,
  progressKey?: string
): Promise<GeneratedIdea[]> {
  const variables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    idea: JSON.stringify(idea, null, 2),
    instruction: JSON.stringify(instruction, null, 2),
  };

  const response = await callAgent('mutator', variables, MutationOutputSchema, {
    progressKey,
  });
  return response.variants;
}
