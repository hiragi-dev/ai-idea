import { callAgent } from '../llm.js';
import { ProblemExtractorOutputSchema } from '../schemas.js';
import type { ProblemSpec } from '../types.js';

export async function extractProblem(inputText: string): Promise<ProblemSpec> {
  const response = await callAgent(
    'problem_extractor',
    { input: inputText },
    ProblemExtractorOutputSchema
  );
  return response.problem_spec;
}
