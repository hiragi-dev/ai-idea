import { callAgent } from '../llm.js';
import { DeepDiverOutputSchema } from '../schemas.js';
import type { ProblemSpec, Idea, GeneratedIdea } from '../types.js';

export async function deepDive(problem: ProblemSpec, idea: Idea): Promise<GeneratedIdea> {
  const variables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    idea: JSON.stringify(idea, null, 2),
  };

  const response = await callAgent('deep_diver', variables, DeepDiverOutputSchema);
  return response.idea;
}
