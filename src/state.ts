import { mkdir, readFile, writeFile, appendFile, readdir, rm } from 'fs/promises';
import path from 'path';
import type { Idea, Evaluation, ProblemSpec } from './types.js';

const STATE_DIR = path.resolve('state');
const ROUNDS_DIR = path.join(STATE_DIR, 'rounds');

export async function ensureStateDir(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(ROUNDS_DIR, { recursive: true });
}

export function getStatePath(name: string): string {
  return path.join(STATE_DIR, name);
}

export async function writeProblem(problem: ProblemSpec): Promise<void> {
  await writeFile(getStatePath('problem.json'), JSON.stringify(problem, null, 2));
}

export async function readProblem(): Promise<ProblemSpec> {
  const raw = await readFile(getStatePath('problem.json'), 'utf-8');
  return JSON.parse(raw) as ProblemSpec;
}

function ideaToLine(idea: Idea): string {
  return JSON.stringify(idea);
}

export async function writeIdeasJsonl(ideas: Idea[]): Promise<void> {
  const lines = ideas.map(ideaToLine).join('\n') + (ideas.length ? '\n' : '');
  await writeFile(getStatePath('ideas.jsonl'), lines);
}

export async function appendIdeas(ideas: Idea[]): Promise<void> {
  if (ideas.length === 0) return;
  const lines = ideas.map(ideaToLine).join('\n') + '\n';
  await appendFile(getStatePath('ideas.jsonl'), lines);
}

export async function readIdeas(): Promise<Idea[]> {
  try {
    const raw = await readFile(getStatePath('ideas.jsonl'), 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Idea);
  } catch {
    return [];
  }
}

function evalToLine(evaluation: Evaluation & { idea_id: string }): string {
  return JSON.stringify(evaluation);
}

export async function writeEvaluationsJsonl(evals: (Evaluation & { idea_id: string })[]): Promise<void> {
  const lines = evals.map(evalToLine).join('\n') + (evals.length ? '\n' : '');
  await writeFile(getStatePath('evaluations.jsonl'), lines);
}

export async function appendEvaluations(evals: (Evaluation & { idea_id: string })[]): Promise<void> {
  if (evals.length === 0) return;
  const lines = evals.map(evalToLine).join('\n') + '\n';
  await appendFile(getStatePath('evaluations.jsonl'), lines);
}

export async function readEvaluations(): Promise<(Evaluation & { idea_id: string })[]> {
  try {
    const raw = await readFile(getStatePath('evaluations.jsonl'), 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Evaluation & { idea_id: string });
  } catch {
    return [];
  }
}

export async function writeRound(round: number, data: unknown): Promise<void> {
  await writeFile(path.join(ROUNDS_DIR, `round_${round}.json`), JSON.stringify(data, null, 2));
}

export async function readRound(round: number): Promise<unknown> {
  const raw = await readFile(path.join(ROUNDS_DIR, `round_${round}.json`), 'utf-8');
  return JSON.parse(raw);
}

export async function listRoundNumbers(): Promise<number[]> {
  try {
    const files = await readdir(ROUNDS_DIR);
    return files
      .filter((f) => f.startsWith('round_') && f.endsWith('.json'))
      .map((f) => parseInt(f.replace('round_', '').replace('.json', ''), 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function roundExists(round: number): Promise<boolean> {
  try {
    await readFile(path.join(ROUNDS_DIR, `round_${round}.json`), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export async function readIdeasByRound(
  round: number,
  createdBy?: string
): Promise<Idea[]> {
  const ideas = await readIdeas();
  return ideas.filter(
    (idea) => idea.round === round && (createdBy ? idea.created_by === createdBy : true)
  );
}

export async function readIdeasByIds(ids: string[]): Promise<Idea[]> {
  const ideaSet = new Set(ids);
  const ideas = await readIdeas();
  return ideas.filter((idea) => ideaSet.has(idea.id));
}

export async function attachEvaluations(ideas: Idea[]): Promise<void> {
  const evaluations = await readEvaluations();
  const map = new Map(evaluations.map((ev) => [ev.idea_id, ev]));
  for (const idea of ideas) {
    const evaluation = map.get(idea.id);
    if (evaluation) idea.evaluations = evaluation;
  }
}

export async function updateIdeasInState(updatedIdeas: Idea[]): Promise<void> {
  const current = await readIdeas();
  const map = new Map(updatedIdeas.map((idea) => [idea.id, idea]));
  const merged = current.map((idea) => map.get(idea.id) ?? idea);
  await writeIdeasJsonl(merged);
}

export async function clearState(): Promise<void> {
  await rm(STATE_DIR, { recursive: true, force: true });
  await ensureStateDir();
}
