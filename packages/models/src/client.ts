import { BackboardClient as BackboardSdkClient } from 'backboard-sdk';

import { validateSpec, type SiteSpec } from '@hereby/spec';

export interface BackboardCompletionOptions {
  model: string;
  provider?: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  content: string;
  usage: TokenUsage;
  wallTimeMs: number;
}

export interface BackboardClientOptions {
  baseUrl?: string;
  apiKey?: string;
}

function parseResponseContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry))).join('');
  }
  return '';
}

const devanagariPattern = /[\u0900-\u097F]/u;
const hinglishMarkerPattern = /\b(?:aur|ki|hai|mein|aap|se|ko|par|saath|chahiye|bhi|sab|bolti|ho|raha|rahi|thora|kya|toh|yeh|bhai|meri|mera|mujhe|dost|yaar)\b/i;

export function detectPromptLanguage(prompt: string): 'english' | 'hindi' | 'hinglish' {
  const trimmed = prompt.trim();
  if (!trimmed) return 'english';

  const hasDevanagari = devanagariPattern.test(trimmed);
  const hasLatinText = /[A-Za-z]/.test(trimmed);

  if (hinglishMarkerPattern.test(trimmed) && (hasLatinText || hasDevanagari)) return 'hinglish';
  if (hasDevanagari) return 'hindi';
  return 'english';
}

export function shouldAskAboutLanguageMix(prompt: string): boolean {
  return detectPromptLanguage(prompt) === 'hinglish';
}

export function buildLanguageFollowupQuestion(prompt: string): string | null {
  if (!shouldAskAboutLanguageMix(prompt)) return null;

  return 'I noticed your brief uses Hinglish. Would you prefer Hinglish in certain sections only, or would you like the site fully in English or Hindi?';
}

export class BackboardClient {
  private readonly client: BackboardSdkClient;

  constructor(options: BackboardClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.BACKBOARD_API_KEY ?? '';
    const baseUrl = options.baseUrl ?? process.env.BACKBOARD_BASE_URL;

    if (!apiKey) throw new Error('Backboard API key is required.');

    this.client = new BackboardSdkClient({
      apiKey,
      ...(baseUrl ? { baseUrl } : {}),
    });
  }

  async complete({ model, provider, prompt, systemPrompt, temperature }: BackboardCompletionOptions): Promise<CompletionResult> {
    const started = Date.now();
    void temperature;

    const response = await this.sendWithRetry({
      content: prompt,
      model_name: model,
      ...(provider ? { llm_provider: provider } : {}),
      ...(systemPrompt ? { system_prompt: systemPrompt } : {}),
      stream: false,
      json_output: true,
    });
    const message = response as {
      content?: unknown;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };

    return {
      content: parseResponseContent(message.content ?? ''),
      usage: {
        promptTokens: Number(message.inputTokens ?? 0),
        completionTokens: Number(message.outputTokens ?? 0),
        totalTokens: Number(message.totalTokens ?? 0),
      },
      wallTimeMs: Date.now() - started,
    };
  }

  private async sendWithRetry(options: {
    content: string;
    model_name: string;
    llm_provider?: string;
    system_prompt?: string;
    stream: false;
    json_output: true;
  }): Promise<unknown> {
    for (let attempt = 0; attempt <= 3; attempt += 1) {
      try {
        return await this.client.sendMessage(options);
      } catch (error) {
        if (attempt >= 3 || !isRetryableError(error)) throw error;
        await delay(250 * 2 ** attempt);
      }
    }

    throw new Error('Retry attempts exhausted.');
  }
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const typedError = error as Error & { statusCode?: number; status?: number };
  const status = typedError.statusCode ?? typedError.status;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function tryParseSiteSpec(raw: string): { ok: true; spec: SiteSpec } | { ok: false; errors: string[]; raw: string } {
  const normalized = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const result = validateSpec(parsed);
    if (result.ok) return { ok: true, spec: result.spec };
    return { ok: false, errors: result.errors, raw: normalized };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Malformed JSON';
    return { ok: false, errors: [message], raw: normalized };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
