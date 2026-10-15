import { BackboardClient, detectPromptLanguage, tryParseInvitationPlan } from '@hereby/models';
import type { InvitationPlan, SiteSpec } from '@hereby/spec';

export interface GenerateSiteInput {
  prompt: string;
  languagePreference?: 'en' | 'hi' | 'hinglish';
}

export interface GenerateSiteResult {
  spec: SiteSpec;
  plan: InvitationPlan;
  language: ReturnType<typeof detectPromptLanguage>;
  attempts: number;
}

function buildSystemPrompt(): string {
  return [
    'You are an invitation experience director.',
    'First interpret the user brief, then design the content architecture and visual direction.',
    'Output only valid JSON matching the InvitationPlan shape below. Never output markdown or explanations.',
    'Extract facts from the brief instead of inventing names, dates, venues, hosts, or ceremonies.',
    'If a required fact is not present, record it in interpretation.unknowns and use "To be announced" only as the visible value.',
    'Choose sections because they fit the occasion and available content. Do not include gallery without imageQueries or schedule without ceremonies.',
    'Use the user language preference for every guest-facing string. Never ask a question in this JSON response.',
    'InvitationPlan shape:',
    JSON.stringify({
      version: 1,
      interpretation: {
        occasion: 'wedding',
        title: 'Aarav & Meher',
        date: '2026-12-14',
        time: '18:30',
        timezone: 'Asia/Kolkata',
        venue: 'The Royal Palace',
        address: 'Connaught Place, New Delhi',
        hosts: ['The Sharma Family'],
        unknowns: [],
      },
      language: 'en',
      copy: {
        heroHeadline: 'Join us for a celebration of love',
        heroSubline: 'December 14 · New Delhi',
        welcome: 'We would be delighted to celebrate with you.',
        story: ['A day woven with laughter, family, and music.'],
        closing: 'We look forward to celebrating with you.',
      },
      ceremonies: [],
      sections: ['hero', 'countdown', 'story', 'venue', 'closing'],
      visualDirection: {
        family: 'floral',
        mood: ['warm', 'joyful'],
        palette: { primary: '#7C1D1D', secondary: '#D4AF37', accent: '#F7E7C6', background: '#FFF8F1', text: '#2B1D1A' },
        typography: { heading: 'playfair', body: 'poppins' },
        motion: { preset: 'drift', intensity: 'medium' },
        interaction: 'sparkles',
        imageQueries: [],
      },
    }),
  ].join('\n');
}

function toIsoDateTime(date: string, time: string, timezone: string): string {
  const offset = timezone === 'Asia/Kolkata' ? '+05:30' : 'Z';
  return `${date}T${time}:00${offset}`;
}

export function compileInvitationPlan(plan: InvitationPlan): SiteSpec {
  if (plan.sections.includes('gallery') && plan.visualDirection.imageQueries.length === 0) {
    throw new Error('Invitation plan includes a gallery section without image queries.');
  }
  if (plan.sections.includes('schedule') && plan.ceremonies.length === 0) {
    throw new Error('Invitation plan includes a schedule section without ceremonies.');
  }

  const scenes: SiteSpec['scenes'] = [];
  for (const section of plan.sections) {
    switch (section) {
      case 'hero':
        scenes.push({ type: 'hero', headline: plan.copy.heroHeadline, ...(plan.copy.heroSubline ? { subline: plan.copy.heroSubline } : {}) });
        break;
      case 'countdown':
        scenes.push({ type: 'countdown', targetDateTime: toIsoDateTime(plan.interpretation.date, plan.interpretation.time, plan.interpretation.timezone) });
        break;
      case 'story':
        scenes.push({ type: 'story', paragraphs: [plan.copy.welcome, ...plan.copy.story] });
        break;
      case 'schedule':
        scenes.push({ type: 'schedule', items: plan.ceremonies });
        break;
      case 'venue':
        scenes.push({
          type: 'venue',
          name: plan.interpretation.venue,
          address: plan.interpretation.address ?? 'To be announced',
          mapsQuery: `${plan.interpretation.venue}, ${plan.interpretation.address ?? ''}`.trim(),
        });
        break;
      case 'gallery':
        scenes.push({ type: 'gallery', imageQueries: plan.visualDirection.imageQueries });
        break;
      case 'closing':
        scenes.push({ type: 'closing', message: plan.copy.closing });
        break;
    }
  }

  return {
    version: 1,
    event: {
      type: plan.interpretation.occasion,
      title: plan.interpretation.title,
      date: plan.interpretation.date,
      time: plan.interpretation.time,
      timezone: plan.interpretation.timezone,
      venue: plan.interpretation.venue,
      ...(plan.interpretation.address ? { address: plan.interpretation.address } : {}),
      hosts: plan.interpretation.hosts,
      language: plan.language,
    },
    ...(plan.ceremonies.length > 0 ? { ceremonies: plan.ceremonies } : {}),
    theme: {
      family: plan.visualDirection.family,
      palette: plan.visualDirection.palette,
      typography: plan.visualDirection.typography,
      mood: plan.visualDirection.mood,
    },
    scenes,
    motion: plan.visualDirection.motion,
    interaction: plan.visualDirection.interaction,
    copy: {
      hero: plan.copy.heroHeadline,
      welcome: plan.copy.welcome,
      closing: plan.copy.closing,
      ...Object.fromEntries(plan.copy.story.map((paragraph, index) => [`story-${index + 1}`, paragraph])),
    },
    sharing: {
      title: plan.interpretation.title,
      description: plan.copy.welcome,
      themeColor: plan.visualDirection.palette.primary,
    },
  };
}

export async function generateSite(input: GenerateSiteInput, client = new BackboardClient()): Promise<GenerateSiteResult> {
  const language = detectPromptLanguage(input.prompt);
  const languageInstruction = input.languagePreference
    ? `Use ${input.languagePreference} for guest-facing copy.`
    : `Use ${language === 'hinglish' ? 'hinglish' : language} for guest-facing copy.`;

  let lastError = 'Model did not return a valid invitation plan.';
  for (let attempts = 1; attempts <= 2; attempts += 1) {
    const completion = await client.complete({
      model: process.env.BAKEOFF_MODELS?.split(',')[0]?.trim() || 'claude-haiku-4-5-20251001',
      provider: process.env.BACKBOARD_LLM_PROVIDER || 'anthropic',
      prompt: `${input.prompt}\n\n${languageInstruction}`,
      systemPrompt: buildSystemPrompt(),
      temperature: 0.2,
    });
    const parsed = tryParseInvitationPlan(completion.content);
    if (parsed.ok) {
      try {
        return { spec: compileInvitationPlan(parsed.plan), plan: parsed.plan, language, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Invitation plan could not be compiled.';
      }
    } else {
      lastError = parsed.errors.join('; ');
    }
  }

  throw new Error(`Unable to generate a valid invitation plan: ${lastError}`);
}
