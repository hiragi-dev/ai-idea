import { callAgent } from '../llm.js';
import { FeedbackCompilerOutputSchema } from '../schemas.js';
import type { ProblemSpec, Idea, Evaluation, MutationInstruction } from '../types.js';

export async function compileFeedback(
  problem: ProblemSpec,
  idea: Idea,
  evaluation: Evaluation,
  progressKey?: string
): Promise<MutationInstruction> {
  const variables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    idea: JSON.stringify(idea, null, 2),
    evaluation: JSON.stringify(evaluation, null, 2),
  };

  const response = await callAgent(
    'feedback_compiler',
    variables,
    FeedbackCompilerOutputSchema,
    { progressKey }
  );
  return response.instruction;
}
