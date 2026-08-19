import { mkdir, readFile, writeFile, appendFile } from 'fs/promises';
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
