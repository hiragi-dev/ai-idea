import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  SAKURA_AI_BASE_URL: z.string(),
  SAKURA_AI_API_KEY: z.string(),
  MODEL_KIMI_27: z.string().default('kimi-k2.7'),
  MODEL_KIMI_26: z.string().default('kimi-k2.6'),
});

export const ENV = envSchema.parse(process.env);

export type ModelKey = 'kimi-2.7' | 'kimi-2.6';

export const CONFIG = {
  sakura: {
    baseURL: ENV.SAKURA_AI_BASE_URL,
    apiKey: ENV.SAKURA_AI_API_KEY,
  },
  models: {
    kimi27: ENV.MODEL_KIMI_27,
    kimi26: ENV.MODEL_KIMI_26,
  },
  resolveModelName(key: ModelKey): string {
    return key === 'kimi-2.7' ? this.models.kimi27 : this.models.kimi26;
  },
  agentDefaults: {
    problem_extractor: { model: 'kimi-2.7' as ModelKey, temperature: 0.3 },
    explorer_pain: { model: 'kimi-2.6' as ModelKey, temperature: 0.9 },
    explorer_anti_agent: { model: 'kimi-2.6' as ModelKey, temperature: 0.85 },
    explorer_interaction: { model: 'kimi-2.6' as ModelKey, temperature: 0.9 },
    explorer_counterfactual: { model: 'kimi-2.6' as ModelKey, temperature: 0.9 },
    explorer_demo: { model: 'kimi-2.6' as ModelKey, temperature: 0.85 },
    deduper: { model: 'kimi-2.7' as ModelKey, temperature: 0.3 },
    judge_official: { model: 'kimi-2.7' as ModelKey, temperature: 0.3 },
    judge_anti_agent: { model: 'kimi-2.7' as ModelKey, temperature: 0.3 },
    judge_demo: { model: 'kimi-2.6' as ModelKey, temperature: 0.3 },
    redteam: { model: 'kimi-2.7' as ModelKey, temperature: 0.3 },
    mutator: { model: 'kimi-2.7' as ModelKey, temperature: 0.7 },
    feedback_compiler: { model: 'kimi-2.7' as ModelKey, temperature: 0.4 },
    deep_diver: { model: 'kimi-2.7' as ModelKey, temperature: 0.4 },
  },
  explorer: {
    countPerAgent: 8,
  },
  concurrency: {
    llm: 5,
  },
  delayMs: 50,
  rounds: {
    maxRounds: 5,
  },
  selection: {
    dedupTarget: 20,
    round2Target: 7,
    round3Target: 5,
    finalTarget: 3,
  },
};
