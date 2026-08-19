import { callAgent } from '../llm.js';
import { ProblemExtractorOutputSchema } from '../schemas.js';
import type { ProblemSpec } from '../types.js';

export async function extractProblem(
  inputText: string,
  progressKey?: string
): Promise<ProblemSpec> {
  const response = await callAgent(
    'problem_extractor',
    { input: inputText },
    ProblemExtractorOutputSchema,
    { progressKey }
  );
  return response.problem_spec;
}
