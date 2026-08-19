import { randomUUID } from 'crypto';
import { createInterface } from 'readline';
import { extractProblem } from '../agents/problemExtractor.js';
import { runExplorers } from '../agents/explorers.js';
import { processSeeds } from '../agents/seedProcessor.js';
import { dedupe } from '../agents/deduper.js';
import { evaluateIdeas } from '../agents/judges.js';
import { runKillGates } from '../agents/redTeam.js';
import { selectParetoFrontier } from '../agents/selector.js';
import { compileFeedback } from '../agents/feedbackCompiler.js';
import { mutateIdea } from '../agents/mutator.js';
import { deepDive } from '../agents/deepDiver.js';
import { CONFIG } from '../config.js';
import {
  ensureStateDir,
  writeProblem,
  writeRound,
  readRound,
  writeIdeasJsonl,
  appendIdeas,
  appendEvaluations,
  readProblem,
  readIdeasByRound,
  readIdeasByIds,
  attachEvaluations,
  listRoundNumbers,
  updateIdeasInState,
  clearState,
} from '../state.js';
import { registerProgressBar, stopProgressBars } from '../progress.js';
import type { ProblemSpec, Idea, GeneratedIdea, IdeaWithEval, Evaluation } from '../types.js';

export type EvolutionOptions = {
  auto: boolean;
  resume: boolean;
  reset: boolean;
};

async function confirmContinue(round: number): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await new Promise<void>((resolve) => {
      rl.question(`Round ${round} completed. Press Enter to continue...`, () => resolve());
    });
  } finally {
    rl.close();
  }
}

function makeIdea(
  generated: GeneratedIdea,
  round: number,
  createdBy: string,
  parentIds: string[] = []
): Idea {
  return {
    ...generated,
    id: randomUUID(),
    parent_ids: parentIds,
    round,
    created_by: createdBy,
  };
}

async function loadSelected(round: number): Promise<IdeaWithEval[]> {
  const data = (await readRound(round)) as { selected_ids?: string[]; final_ids?: string[] };
  const ids = data.selected_ids ?? data.final_ids ?? [];
  const ideas = await readIdeasByIds(ids);
  await attachEvaluations(ideas);
  return ideas.filter((idea): idea is IdeaWithEval => !!idea.evaluations);
}

function attachEvaluationMap(ideas: Idea[], evaluations: (Evaluation & { idea_id: string })[]) {
  const map = new Map(evaluations.map((ev) => [ev.idea_id, ev]));
  for (const idea of ideas) {
    const evaluation = map.get(idea.id);
    if (evaluation) idea.evaluations = evaluation;
  }
}

export async function runEvolution(inputText: string, options: EvolutionOptions) {
  await ensureStateDir();
  if (options.reset) await clearState();

  const completedRounds = options.resume ? await listRoundNumbers() : [];
  const isDone = (round: number) => completedRounds.includes(round);

  let problem: ProblemSpec;

  // Round 0: problem extraction
  if (isDone(0)) {
    console.log('⏭️  Round 0: already completed, loading problem spec...');
    problem = await readProblem();
  } else {
    console.log('🧩 Round 0: extracting problem spec...');
    const key = registerProgressBar('problem_extractor', 1);
    problem = await extractProblem(inputText, key);
    await writeProblem(problem);
    await writeRound(0, { problem });
    console.log(`   → extracted ${problem.pains.length} pains, ${problem.themes.length} themes`);
  }
  if (!options.auto) await confirmContinue(0);

  // Round 1: divergent ideation
  let round1Ideas: Idea[];
  if (isDone(1)) {
    console.log('⏭️  Round 1: already completed, loading deduped ideas...');
    round1Ideas = await readIdeasByRound(1, 'deduper');
  } else {
    console.log('🚀 Round 1: divergent ideation...');
    const seedCount = problem.seed_ideas?.length ?? 0;
    const seedKey = seedCount > 0 ? registerProgressBar('seed_processor', seedCount) : undefined;
    const explorerKey = registerProgressBar('explorers', 5 * CONFIG.explorer.countPerAgent);
    const deduperKey = registerProgressBar('deduper', 1);

    const [explorerResults, seedGenerated] = await Promise.all([
      runExplorers(problem, explorerKey),
      seedCount > 0 ? processSeeds(problem, seedKey) : Promise.resolve([]),
    ]);

    const seedIdeas: Idea[] = seedGenerated.map((generated) =>
      makeIdea(generated, 1, 'seed', [])
    );
    const explorerIdeas: Idea[] = explorerResults
      .flat()
      .map((generated) => makeIdea(generated, 1, 'explorer', []));

    const rawIdeas: Idea[] = [...seedIdeas, ...explorerIdeas];
    await appendIdeas(rawIdeas);
    console.log(
      `   → generated ${rawIdeas.length} raw ideas (${seedIdeas.length} seeds + ${explorerIdeas.length} from explorers)`
    );

    const dedupedGenerated = await dedupe(
      problem,
      rawIdeas,
      CONFIG.selection.dedupTarget,
      deduperKey
    );
    round1Ideas = dedupedGenerated.map((generated) =>
      makeIdea(generated, 1, 'deduper', generated.source_input_ids)
    );
    await appendIdeas(round1Ideas);
    await writeRound(1, {
      raw_count: rawIdeas.length,
      deduped_count: round1Ideas.length,
      deduped_ids: round1Ideas.map((i) => i.id),
    });
    console.log(`   → deduped to ${round1Ideas.length} ideas`);
  }
  if (!options.auto) await confirmContinue(1);

  // Round 2: first judging & Pareto selection
  let selected2: IdeaWithEval[];
  if (isDone(2)) {
    console.log('⏭️  Round 2: already completed, loading selected ideas...');
    selected2 = await loadSelected(2);
  } else {
    console.log('⚖️  Round 2: first judging...');
    const judgeKey = registerProgressBar('judges_round2', round1Ideas.length * 3);
    const evaluations2 = await evaluateIdeas(problem, round1Ideas, judgeKey);
    attachEvaluationMap(round1Ideas, evaluations2);
    await appendEvaluations(evaluations2);

    selected2 = selectParetoFrontier(round1Ideas, CONFIG.selection.round2Target);
    await writeRound(2, {
      selected_count: selected2.length,
      selected_ids: selected2.map((i) => i.id),
      selected_names: selected2.map((i) => i.name),
    });
    console.log(`   → selected ${selected2.length} Pareto-optimal ideas`);
  }
  if (!options.auto) await confirmContinue(2);

  // Round 3: mutation
  let selected3: IdeaWithEval[];
  if (isDone(3)) {
    console.log('⏭️  Round 3: already completed, loading mutated selection...');
    selected3 = await loadSelected(3);
  } else {
    console.log('🧬 Round 3: mutation...');
    const fbKey = registerProgressBar('feedback_compiler', selected2.length);
    const mutKey = registerProgressBar('mutator', selected2.length);

    const instructions = await Promise.all(
      selected2.map((idea) => compileFeedback(problem, idea, idea.evaluations, fbKey))
    );

    const mutatedIdeas: Idea[] = [];
    for (let i = 0; i < selected2.length; i++) {
      const variants = await mutateIdea(problem, selected2[i], instructions[i], mutKey);
      for (const variant of variants) {
        mutatedIdeas.push(makeIdea(variant, 3, 'mutator', [selected2[i].id]));
      }
    }
    await appendIdeas(mutatedIdeas);
    console.log(`   → generated ${mutatedIdeas.length} variants`);

    const judgeKey = registerProgressBar('judges_round3', mutatedIdeas.length * 3);
    const evaluations3 = await evaluateIdeas(problem, mutatedIdeas, judgeKey);
    attachEvaluationMap(mutatedIdeas, evaluations3);
    await appendEvaluations(evaluations3);

    selected3 = selectParetoFrontier(mutatedIdeas, CONFIG.selection.round3Target);
    await writeRound(3, {
      mutated_count: mutatedIdeas.length,
      selected_count: selected3.length,
      selected_ids: selected3.map((i) => i.id),
      selected_names: selected3.map((i) => i.name),
    });
    console.log(`   → selected ${selected3.length} mutated ideas`);
  }
  if (!options.auto) await confirmContinue(3);

  // Round 4: deep dive
  let round4Ideas: Idea[];
  if (isDone(4)) {
    console.log('⏭️  Round 4: already completed, loading deep-dived ideas...');
    const data = (await readRound(4)) as { selected_ids: string[] };
    round4Ideas = await readIdeasByIds(data.selected_ids);
    await attachEvaluations(round4Ideas);
  } else {
    console.log('🔍 Round 4: deep dive...');
    const key = registerProgressBar('deep_diver', selected3.length);
    const deepDived = await Promise.all(
      selected3.map((idea) => deepDive(problem, idea, key))
    );
    round4Ideas = deepDived.map((enriched, index) => ({
      ...enriched,
      id: selected3[index].id,
      parent_ids: selected3[index].parent_ids,
      round: 4,
      created_by: 'deep_diver',
      evaluations: selected3[index].evaluations,
    }));
    await updateIdeasInState(round4Ideas);
    await writeRound(4, {
      deep_dived_count: round4Ideas.length,
      selected_ids: round4Ideas.map((i) => i.id),
      selected_names: round4Ideas.map((i) => i.name),
    });
    console.log(`   → deepened ${round4Ideas.length} ideas`);
  }
  if (!options.auto) await confirmContinue(4);

  // Round 5: final battle (kill gates + final judging)
  let finalIdeas: IdeaWithEval[];
  if (isDone(5)) {
    console.log('⏭️  Round 5: already completed, loading final ideas...');
    finalIdeas = await loadSelected(5);
  } else {
    console.log('⚔️  Round 5: final battle...');
    const redKey = registerProgressBar('redteam', round4Ideas.length);
    const killMap = await runKillGates(problem, round4Ideas, redKey);
    for (const idea of round4Ideas) {
      idea.killed = killMap.get(idea.id) ?? [];
    }
    const survivors = round4Ideas.filter((idea) => (idea.killed ?? []).length === 0);
    console.log(`   → ${survivors.length} survivors passed kill gates`);

    const judgeKey = registerProgressBar('judges_round5', survivors.length * 3);
    const evaluations5 = await evaluateIdeas(problem, survivors, judgeKey);
    attachEvaluationMap(survivors, evaluations5);
    await appendEvaluations(evaluations5);

    finalIdeas = selectParetoFrontier(survivors, CONFIG.selection.finalTarget);
    await updateIdeasInState(finalIdeas);
    await writeRound(5, {
      survivor_count: survivors.length,
      final_count: finalIdeas.length,
      final_ids: finalIdeas.map((i) => i.id),
      final_names: finalIdeas.map((i) => i.name),
    });
    console.log(`   → final ${finalIdeas.length} ideas selected`);
  }

  stopProgressBars();
  return { problem, finalIdeas };
}
