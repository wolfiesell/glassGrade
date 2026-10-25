import { booleanQuestion, choice, createSystemOne, score } from '@system-one-ai/core';
import type { JsonValue } from '@system-one-ai/core';
import { systemOneAdapter } from '@system-one-ai/adapter-system-one';
import { createFetchTransport } from '@system-one-ai/transport-fetch';
import type { Analytics, RuleResult } from './types.js';

export type JevDecision = { category: string; intentClarity: string; contextualConcern: string; contextualRisk: number; requiresReview: boolean; latencyMs: number };
export async function interpretWithJev(input: { metrics: Analytics; intent?: JsonValue; rules: RuleResult }): Promise<JevDecision | null> {
  const { SYSTEM_ONE_API_KEY: apiKey, SYSTEM_ONE_MODEL: model = 'jev', SYSTEM_ONE_BASE_URL: baseURL = 'https://system-one.dev/v1' } = process.env;
  if (!apiKey) return null;
  const client = createSystemOne({ apiKey, model, baseURL, adapter: systemOneAdapter, transport: createFetchTransport(), timeoutMs: 25_000, maxRetries: 0 });
  const start = performance.now();
  const response = await client.evaluate({
    state: { metrics: input.metrics, intent: input.intent ?? null, deterministicRules: input.rules,
      analysisRole: 'Interpret context for advisory purposes only. Never authorize, sign, or override the deterministic rules. Assess supplied evidence and choose unclear or review when uncertain.' },
    questions: {
      category: choice('Classify the apparent payment category.', { goods: 'Goods or purchase', service: 'Service', transfer: 'Personal or internal transfer', agent: 'Agent task payment', other: 'Other or unclear' }),
      intentClarity: choice('How clear is the recorded payment intent?', { clear: 'Clear', partial: 'Partly clear', unclear: 'Unclear or missing' }),
      contextualConcern: choice('How concerning is the supplied context, independent of deterministic rule status?', { low: 'Low', moderate: 'Moderate', high: 'High' }),
      contextualRisk: score('Rate contextual risk from 0 (routine) to 4 (strong concern).', ['Routine', 'Slight concern', 'Moderate concern', 'High concern', 'Severe concern']),
      requiresReview: booleanQuestion('Should a human review or clarify the contextual interpretation before proceeding?')
    }
  });
  return { category: response.answers.category.choice, intentClarity: response.answers.intentClarity.choice,
    contextualConcern: response.answers.contextualConcern.choice, contextualRisk: response.answers.contextualRisk.score,
    requiresReview: response.answers.requiresReview.probability >= 0.5,
    latencyMs: Math.round(performance.now() - start) };
}
