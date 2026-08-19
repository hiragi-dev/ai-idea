import OpenAI from 'openai';
import YAML from 'yaml';
import { readFile } from 'fs/promises';
import { z } from 'zod';
import { CONFIG, type ModelKey } from './config.js';

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

export async function callAgent<T>(
  name: string,
  variables: Record<string, string>,
  schema: z.ZodSchema<T>,
  options?: { model?: ModelKey; temperature?: number; maxTokens?: number }
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

  let lastError: unknown = new Error('unknown');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });
      const text = response.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text);
      return schema.parse(parsed);
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
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
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
