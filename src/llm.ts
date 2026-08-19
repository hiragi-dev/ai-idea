import OpenAI from 'openai';
import YAML from 'yaml';
import { readFile } from 'fs/promises';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import { CONFIG, type ModelKey } from './config.js';
import { tickProgress } from './progress.js';

const client = new OpenAI({
  baseURL: CONFIG.sakura.baseURL,
  apiKey: CONFIG.sakura.apiKey,
});

type PromptTemplate = {
  system?: string;
  user?: string;
  model?: ModelKey;
  temperature?: number;
  max_tokens?: number;
};

export async function loadPrompt(name: string): Promise<PromptTemplate> {
  const raw = await readFile(`prompts/${name}.yaml`, 'utf-8');
  return YAML.parse(raw) as PromptTemplate;
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined ? `{{${key}}}` : value;
  });
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

function safeJsonParse(raw: string): { data: unknown; repaired: boolean } {
  const text = extractJsonText(raw);
  try {
    return { data: JSON.parse(text), repaired: false };
  } catch {
    const repairedText = extractJsonText(jsonrepair(text));
    return { data: JSON.parse(repairedText), repaired: true };
  }
}

function getRetryDelay(err: unknown, attempt: number): number {
  const isRateLimit =
    err instanceof OpenAI.APIError && err.status === 429;
  if (isRateLimit) {
    const retryAfter =
      err instanceof OpenAI.APIError
        ? err.headers?.['retry-after']
        : undefined;
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) return seconds * 1000;
    }
    return Math.min(60000, 2000 * 2 ** attempt);
  }
  return 500 * attempt;
}

export async function callAgent<T>(
  name: string,
  variables: Record<string, string>,
  schema: z.ZodSchema<T>,
  options?: { model?: ModelKey; temperature?: number; maxTokens?: number; progressKey?: string }
): Promise<T> {
  const prompt = await loadPrompt(name);
  const systemRaw = prompt.system ? renderTemplate(prompt.system, variables) : undefined;
  const userRaw = prompt.user ? renderTemplate(prompt.user, variables) : '';

  const modelKey = options?.model ?? prompt.model ?? 'kimi-2.6';
  const modelName = CONFIG.resolveModelName(modelKey);
  const temperature = options?.temperature ?? prompt.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? prompt.max_tokens;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemRaw) {
    messages.push({ role: 'system', content: systemRaw });
  }
  messages.push({ role: 'user', content: userRaw });

  const maxAttempts = 5;
  let lastError: unknown = new Error('unknown');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let text = '';
    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      });
      text = response.choices[0]?.message?.content ?? '';
      if (!text) {
        console.error(
          `Agent ${name} attempt ${attempt} got empty content. ` +
            `finish_reason=${response.choices[0]?.finish_reason}, usage=${JSON.stringify(response.usage)}`
        );
        throw new Error('Empty response content from API');
      }
      const { data: parsed, repaired } = safeJsonParse(text);
      const validated = schema.parse(parsed);
      if (repaired) {
        console.warn(`Agent ${name} returned malformed JSON on attempt ${attempt}; repaired and parsed.`);
      }
      tickProgress(options?.progressKey);
      return validated;
    } catch (err) {
      lastError = err;
      console.error(`Agent ${name} attempt ${attempt} failed: ${String(err).slice(0, 500)}`);
      console.error(`Raw response (first 3000 chars):\n${text.slice(0, 3000)}`);
      if (attempt < maxAttempts) {
        const delay = getRetryDelay(err, attempt);
        console.error(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`Agent ${name} failed after retries: ${String(lastError)}`);
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
      if (CONFIG.delayMs > 0 && nextIndex < items.length) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.delayMs));
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
