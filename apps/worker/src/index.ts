import { BackboardClient, detectPromptLanguage, tryParseBriefIntake, tryParseInvitationPlan } from '@hereby/models';
import type { BriefIntake, InvitationPlan, SiteSpec } from '@hereby/spec';

export interface GenerateSiteInput {
  prompt: string;
  languagePreference?: 'en' | 'hi' | 'hinglish';
  answers?: Record<string, string>;
}

export interface GenerateSiteResult {
  spec: SiteSpec;
  plan: InvitationPlan;
  language: ReturnType<typeof detectPromptLanguage>;
  attempts: number;
}

export interface AnalyzeBriefResult {
  intake: BriefIntake;
  language: ReturnType<typeof detectPromptLanguage>;
}

function buildSystemPrompt(): string {
  return [
    'You are an invitation experience director.',
    'First interpret the user brief, then design the content architecture and visual direction.',
    'Output only valid JSON matching the InvitationPlan shape below. Never output markdown or explanations.',
    'Extract facts from the brief instead of inventing names, dates, venues, hosts, or ceremonies.',
    'Do not invent required facts. Use the host answers supplied after the brief as authoritative context, and keep optional unknowns out of the visible copy.',
    'Choose sections because they fit the occasion and available content. Do not include gallery without imageQueries or schedule without ceremonies.',
    'Use guestInfo for useful host-provided details such as dress code, RSVP instructions, travel, accessibility, or contact information.',
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
      guestInfo: [{ label: 'Dress code', value: 'Festive Indian' }],
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

function buildIntakePrompt(): string {
  return [
    'You are the intake director for an immersive invitation website.',
    'Read the brief and identify facts that are explicitly present. Never invent facts.',
    'Ask only the highest-value questions needed to make a useful, informative invitation.',
    'For a publishable invitation, prioritize date, time, venue, hosts, and the occasion-specific details guests need.',
    'Ask no more than six questions. Do not ask for information that is already present.',
    'Set ready to true only when the invitation can be meaningfully generated from the brief and known facts.',
    'Output only JSON matching this shape:',
    JSON.stringify({
      version: 1,
      ready: false,
      occasion: 'wedding',
      known: {
        title: 'Aarav & Meher',
        date: '2026-12-14',
        time: '18:30',
        timezone: 'Asia/Kolkata',
        venue: 'The Royal Palace',
        address: 'Connaught Place, New Delhi',
        hosts: ['The Sharma Family'],
        guestNotes: ['Dress code: festive Indian'],
      },
      questions: [
        {
          id: 'dress-code',
          question: 'Is there a dress code or any note guests should know before arriving?',
          reason: 'This helps guests prepare for the celebration.',
          required: false,
        },
      ],
    }),
  ].join('\n');
}

function ensureCriticalIntakeQuestions(intake: BriefIntake): BriefIntake {
  const questions = [...intake.questions];
  const addQuestion = (id: string, question: string, reason: string) => {
    if (!questions.some((item) => item.id === id) && questions.length < 6) {
      questions.push({ id, question, reason, required: true });
    }
  };

  if (!intake.known.date) addQuestion('event-date', 'What date should guests save for the celebration?', 'The date is needed for the invitation header, schedule, and countdown.');
  if (!intake.known.time) addQuestion('event-time', 'What time should guests arrive or what time does the main celebration begin?', 'A clear start time helps guests plan and makes the schedule useful.');
  if (!intake.known.venue) addQuestion('event-venue', 'Where will the celebration take place?', 'The venue is essential for an informative invitation and directions.');
  if (intake.known.hosts.length === 0) addQuestion('hosts', 'Who is hosting or being celebrated?', 'Names make the invitation personal and help guests understand who is inviting them.');
  if (!intake.known.title && intake.occasion === 'other') {
    addQuestion('occasion-title', 'What should we call this celebration?', 'A clear title gives the invitation a memorable identity.');
  }

  return {
    ...intake,
    ready: questions.every((question) => !question.required),
    questions,
  };
}

export async function analyzeBrief(prompt: string, client: Pick<BackboardClient, 'complete'> = new BackboardClient()): Promise<AnalyzeBriefResult> {
  const language = detectPromptLanguage(prompt);
  const completion = await client.complete({
    model: process.env.BAKEOFF_MODELS?.split(',')[0]?.trim() || 'claude-haiku-4-5-20251001',
    provider: process.env.BACKBOARD_LLM_PROVIDER || 'anthropic',
    prompt,
    systemPrompt: buildIntakePrompt(),
    temperature: 0.1,
  });
  const parsed = tryParseBriefIntake(completion.content);
  if (!parsed.ok) throw new Error(`Unable to understand invitation brief: ${parsed.errors.join('; ')}`);
  return { intake: ensureCriticalIntakeQuestions(parsed.intake), language };
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
  if (plan.sections.includes('details') && plan.guestInfo.length === 0) {
    throw new Error('Invitation plan includes a details section without guest information.');
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
      case 'details':
        scenes.push({ type: 'details', title: 'Good to know', items: plan.guestInfo });
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

export async function generateSite(input: GenerateSiteInput, client: Pick<BackboardClient, 'complete'> = new BackboardClient()): Promise<GenerateSiteResult> {
  const language = detectPromptLanguage(input.prompt);
  const languageInstruction = input.languagePreference
    ? `Use ${input.languagePreference} for guest-facing copy.`
    : `Use ${language === 'hinglish' ? 'hinglish' : language} for guest-facing copy.`;

  let lastError = 'Model did not return a valid invitation plan.';
  for (let attempts = 1; attempts <= 2; attempts += 1) {
    const completion = await client.complete({
      model: process.env.BAKEOFF_MODELS?.split(',')[0]?.trim() || 'claude-haiku-4-5-20251001',
      provider: process.env.BACKBOARD_LLM_PROVIDER || 'anthropic',
      prompt: `${input.prompt}\n\n${input.answers ? `Additional answers from the host:\n${JSON.stringify(input.answers)}\n` : ''}${languageInstruction}`,
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
