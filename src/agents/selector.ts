import type { Evaluation, Idea, IdeaWithEval } from '../types.js';

export function selectParetoFrontier(
  ideas: (Idea & { evaluations?: Evaluation })[],
  maxCount: number
): IdeaWithEval[] {
  const withEval = ideas.filter((idea): idea is IdeaWithEval => !!idea.evaluations);

  if (withEval.length === 0) return [];
  if (withEval.length <= maxCount) return withEval;

  const scores = withEval.map((idea) => extractObjectives(idea.evaluations));
  const dominated = new Set<string>();

  for (let a = 0; a < withEval.length; a++) {
    for (let b = 0; b < withEval.length; b++) {
      if (a === b) continue;
      if (dominates(scores[b], scores[a])) {
        dominated.add(withEval[a].id);
      }
    }
  }

  let frontier = withEval.filter((idea) => !dominated.has(idea.id));

  if (frontier.length > maxCount) {
    const norms = normalizeScores(frontier.map((idea) => extractObjectives(idea.evaluations)));
    const distances = crowdingDistances(norms);
    const indexed = frontier.map((idea, idx) => ({ idea, distance: distances[idx] }));
    indexed.sort((a, b) => b.distance - a.distance);
    frontier = indexed.slice(0, maxCount).map((item) => item.idea);
  }

  return frontier;
}

function extractObjectives(evaluation: Evaluation): Record<string, number> {
  return {
    official: evaluation.official.total,
    anti_agent: -evaluation.anti_agent.agent_replaceability,
    demo: (evaluation.demo.memorable_30min + evaluation.demo.demo_clarity) / 2,
    novelty: evaluation.novelty,
  };
}

function dominates(a: Record<string, number>, b: Record<string, number>): boolean {
  let strictlyBetter = false;
  for (const key of Object.keys(a)) {
    if (a[key] < b[key]) return false;
    if (a[key] > b[key]) strictlyBetter = true;
  }
  return strictlyBetter;
}

function normalizeScores(scores: Record<string, number>[]): Record<string, number>[] {
  const keys = Object.keys(scores[0]);
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};

  for (const key of keys) {
    const values = scores.map((s) => s[key]);
    mins[key] = Math.min(...values);
    maxs[key] = Math.max(...values);
  }

  return scores.map((score) => {
    const normalized: Record<string, number> = {};
    for (const key of keys) {
      const range = maxs[key] - mins[key];
      normalized[key] = range === 0 ? 0.5 : (score[key] - mins[key]) / range;
    }
    return normalized;
  });
}

function crowdingDistances(normalized: Record<string, number>[]): number[] {
  const distances = new Array(normalized.length).fill(0);
  const keys = Object.keys(normalized[0]);

  for (const key of keys) {
    const sorted = normalized
      .map((score, index) => ({ score, index }))
      .sort((a, b) => a.score[key] - b.score[key]);

    distances[sorted[0].index] = Infinity;
    distances[sorted[sorted.length - 1].index] = Infinity;

    const range = sorted[sorted.length - 1].score[key] - sorted[0].score[key];
    for (let i = 1; i < sorted.length - 1; i++) {
      const diff = sorted[i + 1].score[key] - sorted[i - 1].score[key];
      distances[sorted[i].index] += range === 0 ? 0 : diff / range;
    }
  }

  return distances;
}
