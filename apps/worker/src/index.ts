import { BackboardClient, detectPromptLanguage, tryParseSiteSpec } from '@hereby/models';
import type { SiteSpec } from '@hereby/spec';

export interface GenerateSiteInput {
  prompt: string;
  languagePreference?: 'en' | 'hi' | 'hinglish';
}

export interface GenerateSiteResult {
  spec: SiteSpec;
  language: ReturnType<typeof detectPromptLanguage>;
  attempts: number;
}

function buildSystemPrompt(): string {
  return [
    'You generate invitation site specifications.',
    'Output only valid JSON matching the provided SiteSpec shape. Never output markdown or explanations.',
    'Use only the enum values present in the shape. Required strings must be non-empty; omit unknown optional values.',
  ].join('\n');
}

export async function generateSite(input: GenerateSiteInput, client = new BackboardClient()): Promise<GenerateSiteResult> {
  const language = detectPromptLanguage(input.prompt);
  const languageInstruction = input.languagePreference
    ? `Use ${input.languagePreference} for guest-facing copy.`
    : `Use ${language === 'hinglish' ? 'hinglish' : language} for guest-facing copy.`;

  let lastError = 'Model did not return a valid SiteSpec.';
  for (let attempts = 1; attempts <= 2; attempts += 1) {
    const completion = await client.complete({
      model: process.env.BAKEOFF_MODELS?.split(',')[0]?.trim() || 'claude-haiku-4-5-20251001',
      provider: process.env.BACKBOARD_LLM_PROVIDER || 'anthropic',
      prompt: `${input.prompt}\n\n${languageInstruction}`,
      systemPrompt: buildSystemPrompt(),
      temperature: 0.2,
    });
    const parsed = tryParseSiteSpec(completion.content);
    if (parsed.ok) return { spec: parsed.spec, language, attempts };
    lastError = parsed.errors.join('; ');
  }

  throw new Error(`Unable to generate a valid invitation specification: ${lastError}`);
}
