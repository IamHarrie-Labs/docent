import OpenAI from 'openai';
import { recordUsage } from './db';

// Single client for the whole app — every LLM call in Docent goes through
// the BTL Runtime gateway (OpenAI-compatible).
export const btl = new OpenAI({
  baseURL: process.env.BTL_BASE_URL ?? 'https://api.badtheorylabs.com/v1',
  apiKey: process.env.BTL_API_KEY ?? '',
});

export const AGENT_MODEL = process.env.DOCENT_AGENT_MODEL ?? 'deepseek-v4-flash';
export const SYNTH_MODEL = process.env.DOCENT_SYNTH_MODEL ?? 'deepseek-v4-pro';
export const EMBED_MODEL = process.env.DOCENT_EMBED_MODEL ?? 'text-embedding-3-small';

// Rough DeepSeek-class pricing for the live cost meter (USD per 1M tokens).
// The dashboard labels these as estimates; exact spend lives in the BTL console.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'deepseek-v4-flash': { in: 0.14, out: 0.28 },
  'deepseek-v4-pro': { in: 0.55, out: 2.19 },
  'text-embedding-3-small': { in: 0.02, out: 0 },
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICE_PER_M[model] ?? { in: 0.5, out: 1.5 };
  return (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
}

/** Record a usage event from any BTL response into the meter. */
export function trackUsage(
  repoId: number | null,
  model: string,
  kind: 'chat' | 'embed' | 'agent',
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
) {
  const pt = usage?.prompt_tokens ?? 0;
  const ct = usage?.completion_tokens ?? 0;
  recordUsage(repoId, model, kind, pt, ct, estimateCost(model, pt, ct));
}
