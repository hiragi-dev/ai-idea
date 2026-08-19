import { callAgent, runWithConcurrency } from '../llm.js';
import { DeduperSelectOutputSchema, MergerOutputSchema } from '../schemas.js';
import { CONFIG } from '../config.js';
import type { ProblemSpec, Idea, DedupedIdea } from '../types.js';

export async function dedupe(
  problem: ProblemSpec,
  ideas: Idea[],
  targetCount?: number,
  progressKey?: string
): Promise<DedupedIdea[]> {
  const summaries = ideas.map((idea) => ({
    id: idea.id,
    name: idea.name,
    one_liner: idea.one_liner,
    pain: idea.pain,
    core_insight: idea.core_insight,
    human_ai_interaction: idea.human_ai_interaction,
    why_not_normal_agent: idea.why_not_normal_agent,
  }));

  const selectVariables: Record<string, string> = {
    problem_spec: JSON.stringify(problem, null, 2),
    ideas: JSON.stringify(summaries, null, 2),
    target_count: String(targetCount ?? Math.max(1, Math.ceil(ideas.length / 2))),
  };

  const selectResponse = await callAgent(
    'deduper_select',
    selectVariables,
    DeduperSelectOutputSchema,
    { progressKey }
  );
  const selected = selectResponse.selected;

  const ideaMap = new Map(ideas.map((idea) => [idea.id, idea]));

  const mergeTasks = selected
    .filter((item) => item.source_input_ids.length > 1)
    .map((item) => ({
      source_input_ids: item.source_input_ids,
      merge_reason: item.merge_reason,
      inputIdeas: item.source_input_ids
        .map((id) => ideaMap.get(id))
        .filter((idea): idea is Idea => idea !== undefined),
    }));

  const mergedResults = await runWithConcurrency(
    mergeTasks,
    CONFIG.concurrency.llm,
    async (task) => {
      const response = await callAgent(
        'merger',
        {
          problem_spec: JSON.stringify(problem, null, 2),
          ideas: JSON.stringify(task.inputIdeas, null, 2),
          merge_reason: task.merge_reason,
        },
        MergerOutputSchema,
        { progressKey }
      );
      return {
        key: task.source_input_ids.join(','),
        source_input_ids: task.source_input_ids,
        merge_reason: task.merge_reason,
        idea: response.idea,
      };
    }
  );
  const mergedMap = new Map(mergedResults.map((r) => [r.key, r]));

  const result: DedupedIdea[] = selected.map((item) => {
    if (item.source_input_ids.length === 1) {
      const original = ideaMap.get(item.source_input_ids[0])!;
      return {
        ...original,
        source_input_ids: item.source_input_ids,
        merge_reason: item.merge_reason,
      };
    }
    const merged = mergedMap.get(item.source_input_ids.join(','));
    if (!merged) {
      throw new Error(
        `Merger did not produce result for group ${item.source_input_ids.join(',')}`
      );
    }
    return {
      ...merged.idea,
      source_input_ids: item.source_input_ids,
      merge_reason: item.merge_reason,
    };
  });

  return result;
}
