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
  appendIdeas,
  appendEvaluations,
  readIdeas,
  writeIdeasJsonl,
} from '../state.js';
import type { ProblemSpec, Idea, GeneratedIdea } from '../types.js';

export type EvolutionOptions = {
  auto: boolean;
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

async function updateIdeasInState(updatedIdeas: Idea[]): Promise<void> {
  const current = await readIdeas();
  const map = new Map(updatedIdeas.map((idea) => [idea.id, idea]));
  const merged = current.map((idea) => map.get(idea.id) ?? idea);
  await writeIdeasJsonl(merged);
}

export async function runEvolution(inputText: string, options: EvolutionOptions) {
  await ensureStateDir();

  // Round 0: problem extraction
  console.log('🧩 Round 0: extracting problem spec...');
  const problem: ProblemSpec = await extractProblem(inputText);
  await writeProblem(problem);
  await writeRound(0, { problem });
  console.log(`   → extracted ${problem.pains.length} pains, ${problem.themes.length} themes`);
  if (!options.auto) await confirmContinue(0);

  // Round 1: divergent ideation
  console.log('🚀 Round 1: divergent ideation (5 explorers + seeds in parallel)...');
  const [explorerResults, seedGenerated] = await Promise.all([
    runExplorers(problem),
    processSeeds(problem),
  ]);

  const seedIdeas: Idea[] = seedGenerated.map((generated) => makeIdea(generated, 1, 'seed', []));
  const explorerIdeas: Idea[] = explorerResults
    .flat()
    .map((generated) => makeIdea(generated, 1, 'explorer', []));

  const rawIdeas: Idea[] = [...seedIdeas, ...explorerIdeas];
  await appendIdeas(rawIdeas);
  console.log(`   → generated ${rawIdeas.length} raw ideas (${seedIdeas.length} seeds + ${explorerIdeas.length} from explorers)`);

  const dedupedGenerated = await dedupe(problem, rawIdeas, CONFIG.selection.dedupTarget);
  const round1Ideas: Idea[] = dedupedGenerated.map((generated) =>
    makeIdea(generated, 1, 'deduper', generated.source_input_ids)
  );
  await appendIdeas(round1Ideas);
  await writeRound(1, {
    raw_count: rawIdeas.length,
    deduped_count: round1Ideas.length,
    deduped_ids: round1Ideas.map((i) => i.id),
  });
  console.log(`   → deduped to ${round1Ideas.length} ideas`);
  if (!options.auto) await confirmContinue(1);

  // Round 2: first judging & Pareto selection
  console.log('⚖️  Round 2: first judging (3 judges in parallel)...');
  const evaluations2 = await evaluateIdeas(problem, round1Ideas);
  for (const evaluation of evaluations2) {
    const idea = round1Ideas.find((i) => i.id === evaluation.idea_id);
    if (idea) idea.evaluations = evaluation;
  }
  await appendEvaluations(evaluations2);

  const selected2 = selectParetoFrontier(round1Ideas, CONFIG.selection.round2Target);
  await writeRound(2, {
    selected_count: selected2.length,
    selected_ids: selected2.map((i) => i.id),
    selected_names: selected2.map((i) => i.name),
  });
  console.log(`   → selected ${selected2.length} Pareto-optimal ideas`);
  if (!options.auto) await confirmContinue(2);

  // Round 3: mutation
  console.log('🧬 Round 3: mutation (strengthen / invert / escape)...');
  const instructions = await Promise.all(
    selected2.map((idea) => compileFeedback(problem, idea, idea.evaluations))
  );

  const mutatedIdeas: Idea[] = [];
  for (let i = 0; i < selected2.length; i++) {
    const parent = selected2[i];
    const instruction = instructions[i];
    const variants = await mutateIdea(problem, parent, instruction);
    for (const variant of variants) {
      mutatedIdeas.push(
        makeIdea(variant, 3, 'mutator', [parent.id])
      );
    }
  }
  await appendIdeas(mutatedIdeas);
  console.log(`   → generated ${mutatedIdeas.length} variants`);

  const evaluations3 = await evaluateIdeas(problem, mutatedIdeas);
  for (const evaluation of evaluations3) {
    const idea = mutatedIdeas.find((i) => i.id === evaluation.idea_id);
    if (idea) idea.evaluations = evaluation;
  }
  await appendEvaluations(evaluations3);

  const selected3 = selectParetoFrontier(mutatedIdeas, CONFIG.selection.round3Target);
  await writeRound(3, {
    mutated_count: mutatedIdeas.length,
    selected_count: selected3.length,
    selected_ids: selected3.map((i) => i.id),
    selected_names: selected3.map((i) => i.name),
  });
  console.log(`   → selected ${selected3.length} mutated ideas`);
  if (!options.auto) await confirmContinue(3);

  // Round 4: deep dive
  console.log('🔍 Round 4: deep dive...');
  const deepDived = await Promise.all(selected3.map((idea) => deepDive(problem, idea)));
  const round4Ideas: Idea[] = deepDived.map((enriched, index) => ({
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
  if (!options.auto) await confirmContinue(4);

  // Round 5: final battle (kill gates + final judging)
  console.log('⚔️  Round 5: final battle (kill gates + final judging)...');
  const killMap = await runKillGates(problem, round4Ideas);
  for (const idea of round4Ideas) {
    idea.killed = killMap.get(idea.id) ?? [];
  }
  const survivors = round4Ideas.filter((idea) => (idea.killed ?? []).length === 0);
  console.log(`   → ${survivors.length} survivors passed kill gates`);

  const evaluations5 = await evaluateIdeas(problem, survivors);
  for (const evaluation of evaluations5) {
    const idea = survivors.find((i) => i.id === evaluation.idea_id);
    if (idea) idea.evaluations = evaluation;
  }
  await appendEvaluations(evaluations5);

  const finalIdeas = selectParetoFrontier(survivors, CONFIG.selection.finalTarget);
  await updateIdeasInState(finalIdeas);
  await writeRound(5, {
    survivor_count: survivors.length,
    final_count: finalIdeas.length,
    final_ids: finalIdeas.map((i) => i.id),
    final_names: finalIdeas.map((i) => i.name),
  });
  console.log(`   → final ${finalIdeas.length} ideas selected`);

  return { problem, finalIdeas };
}
