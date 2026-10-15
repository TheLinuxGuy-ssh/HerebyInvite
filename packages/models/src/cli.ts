import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SPEC_JSON_EXAMPLE } from '@hereby/spec';

import { BackboardClient, detectPromptLanguage, tryParseSiteSpec } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const promptFilePath = join(repoRoot, 'prompts', 'hinglish-prompts.jsonl');
const priceFilePath = join(__dirname, '../prices.json');

interface PromptBrief {
  id: string;
  text: string;
}

interface BakeoffRow {
  model: string;
  briefId: string;
  promptText: string;
  parseJson: boolean;
  validSpec: boolean;
  firstError: string;
  wallMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: string;
  languageCheck: boolean;
}

function parseCliArguments(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === '--models' || token === '--runs' || token === '--max-prompts') {
      const next = argv[index + 1];
      if (next) {
        result[token.slice(2).replace(/-+/g, '-')] = next;
        index += 1;
      }
      continue;
    }

    if (token.startsWith('--models=')) {
      result.models = token.slice('--models='.length);
    }
    if (token.startsWith('--runs=')) {
      result.runs = token.slice('--runs='.length);
    }
    if (token.startsWith('--max-prompts=')) {
      result['max-prompts'] = token.slice('--max-prompts='.length);
    }
  }
  return result;
}

function readPrompts(): PromptBrief[] {
  const content = readFileSync(promptFilePath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PromptBrief);
}

function isDevanagariPresent(value: string): boolean {
  return /[\u0900-\u097F]/u.test(value);
}

function formatCostUsd(model: string, promptTokens: number, completionTokens: number): string {
  const priceMap = JSON.parse(readFileSync(priceFilePath, 'utf8')) as Record<string, { input: number; output: number }>;
  const rates = priceMap[model];
  if (!rates) {
    return 'n/a';
  }

  const cost = (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000;
  return cost.toFixed(6);
}

function buildSystemPrompt(): string {
  return [
    'You are an invitation site director.',
    'Output ONLY a JSON site specification matching this shape:',
    JSON.stringify(SPEC_JSON_EXAMPLE, null, 0),
    'Rules: do not default to Hinglish. Only use Hinglish if the user prompt itself contains Hinglish. The product asks Hinglish users for language preference before publishing; this bake-off is only evaluating provisional JSON generation, so do not ask questions or emit prose. Every required value must be non-empty. If an optional value is unknown, omit the field rather than emitting an empty string. Never invent enum values: event language is only en, hi, or hinglish; theme family is only floral or playful; motion preset is only none, drift, pulse, or rise; motion intensity is only subtle, medium, or lively. Keep the output compact and free of markdown.',
  ].join('\n');
}

export interface RunOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export async function run(options: RunOptions = {}): Promise<{ jsonPath: string; markdownPath: string; rows: BakeoffRow[] }> {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;
  const argv = options.argv ?? process.argv;
  const cliArgs = parseCliArguments(argv.slice(2));
  const modelList = (cliArgs.models ?? env.BAKEOFF_MODELS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const runs = Number.parseInt(cliArgs.runs ?? env.BAKEOFF_RUNS ?? '1', 10) || 1;

  if (modelList.length === 0) {
    logger.error('No models provided. Pass --models or set BAKEOFF_MODELS.');
    process.exitCode = 1;
    return { jsonPath: '', markdownPath: '', rows: [] };
  }

  if (!env.BACKBOARD_API_KEY) {
    logger.error('Backboard is not configured. Set BACKBOARD_API_KEY to run a real model evaluation.');
    process.exitCode = 1;
    return { jsonPath: '', markdownPath: '', rows: [] };
  }

  const client = new BackboardClient({
    ...(env.BACKBOARD_BASE_URL ? { baseUrl: env.BACKBOARD_BASE_URL } : {}),
    apiKey: env.BACKBOARD_API_KEY,
  });
  const briefs = readPrompts();
  const maxPrompts = Number.parseInt(cliArgs['max-prompts'] ?? env.BAKEOFF_MAX_PROMPTS ?? String(briefs.length), 10) || briefs.length;
  const selectedBriefs = briefs.slice(0, Math.min(maxPrompts, briefs.length));
  const rows: BakeoffRow[] = [];

  for (const model of modelList) {
    for (const brief of selectedBriefs) {
      for (let runIndex = 0; runIndex < runs; runIndex += 1) {
        const completion = await client.complete({
          model,
          ...(env.BACKBOARD_LLM_PROVIDER ? { provider: env.BACKBOARD_LLM_PROVIDER } : {}),
          prompt: brief.text,
          systemPrompt: buildSystemPrompt(),
          temperature: 0.2,
        });

        const parsed = tryParseSiteSpec(completion.content);
        const firstError = parsed.ok ? 'valid' : (parsed.errors[0] ?? 'invalid');
        const validSpec = parsed.ok;
        const language = detectPromptLanguage(brief.text);
        const languageCheck = language === 'hindi'
          ? isDevanagariPresent(completion.content)
          : language === 'hinglish'
            ? /(?:\b(?:aur|hai|aap|meri|mujhe|chahiye|shaadi|birthday)\b|[\u0900-\u097F])/iu.test(completion.content)
            : true;

        rows.push({
          model,
          briefId: brief.id,
          promptText: brief.text,
          parseJson: parsed.ok,
          validSpec,
          firstError,
          wallMs: completion.wallTimeMs,
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          costUsd: formatCostUsd(model, completion.usage.promptTokens, completion.usage.completionTokens),
          languageCheck,
        });

        if (runIndex === runs - 1 && validSpec === false) {
          logger.warn(`Model ${model} failed validation for ${brief.id}: ${firstError}`);
        }
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = join(repoRoot, 'results');
  mkdirSync(resultsDir, { recursive: true });

  const summary = {
    generatedAt: new Date().toISOString(),
    runs,
    models: modelList,
    promptLimit: selectedBriefs.length,
    rows,
  };

  const jsonPath = join(resultsDir, `bakeoff-${timestamp}.json`);
  const markdownPath = join(resultsDir, `bakeoff-${timestamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const markdownRows = rows.map((row) => {
    const parseCell = row.parseJson ? 'yes' : 'no';
    const validCell = row.validSpec ? 'yes' : 'no';
    return `| ${row.model} | ${row.briefId} | ${parseCell} | ${validCell} | ${row.wallMs}ms | ${row.promptTokens} | ${row.completionTokens} | ${row.costUsd} | ${row.languageCheck ? 'pass' : 'fail'} | ${row.firstError} |`;
  }).join('\n');

  const markdown = [
    '# Bake-off results',
    '',
    '| Model | Brief | JSON parse | Spec valid | Latency | Prompt tokens | Completion tokens | Cost (USD) | Language check | First error |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    markdownRows,
    '',
  ].join('\n');

  writeFileSync(markdownPath, `${markdown}\n`, 'utf8');
  logger.log(`Bake-off results written to ${jsonPath} and ${markdownPath}`);
  return { jsonPath, markdownPath, rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
