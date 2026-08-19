import { callAgent, runWithConcurrency } from '../llm.js';
import {
  JudgeOfficialOutputSchema,
  JudgeAntiAgentOutputSchema,
  JudgeDemoOutputSchema,
} from '../schemas.js';
import { CONFIG } from '../config.js';
import type { ProblemSpec, Idea, Evaluation } from '../types.js';

export async function evaluateIdeas(
  problem: ProblemSpec,
  ideas: Idea[],
  progressKey?: string
): Promise<(Evaluation & { idea_id: string })[]> {
  const baseVars: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
  };

  return runWithConcurrency(ideas, CONFIG.concurrency.llm, async (idea) => {
    const ideaJson = JSON.stringify(idea, null, 2);

    const [officialRes, antiRes, demoRes] = await Promise.all([
      callAgent('judge_official', { ...baseVars, idea: ideaJson }, JudgeOfficialOutputSchema, { progressKey }),
      callAgent('judge_anti_agent', { ...baseVars, idea: ideaJson }, JudgeAntiAgentOutputSchema, { progressKey }),
      callAgent('judge_demo', { ...baseVars, idea: ideaJson }, JudgeDemoOutputSchema, { progressKey }),
    ]);

    const evaluation: Evaluation = {
      official: officialRes.official,
      anti_agent: antiRes.anti_agent,
      demo: demoRes.demo,
      novelty: computeNovelty(officialRes.official, antiRes.anti_agent),
    };

    return { ...evaluation, idea_id: idea.id };
  });
}

function computeNovelty(
  official: { novelty: number },
  antiAgent: { agent_replaceability: number }
): number {
  return (official.novelty + (10 - antiAgent.agent_replaceability)) / 2;
}
