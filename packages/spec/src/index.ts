import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Date must be a valid ISO date');

const timeOfDay = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Expected time in HH:mm format');
const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Expected hex color like #RRGGBB');
const nonEmptyString = z.string().min(1).trim();

const eventTypes = ['wedding', 'engagement', 'roka', 'birthday', 'anniversary', 'housewarming', 'baby_shower', 'other'] as const;
const languages = ['en', 'hi', 'hinglish'] as const;
const themeFamilies = ['floral', 'playful'] as const;
const motionPresets = ['none', 'drift', 'pulse', 'rise'] as const;
const motionIntensities = ['subtle', 'medium', 'lively'] as const;
const ceremonySchema = z.object({
  name: nonEmptyString,
  date: isoDate,
  time: timeOfDay,
  venue: nonEmptyString,
});

const eventSchema = z.object({
  type: z.enum(eventTypes),
  title: nonEmptyString,
  date: isoDate,
  time: timeOfDay,
  timezone: nonEmptyString,
  venue: nonEmptyString,
  address: nonEmptyString.optional(),
  hosts: z.array(nonEmptyString).min(1),
  language: z.enum(languages),
});

const themePaletteSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  background: hexColor,
  text: hexColor,
});

const typographySchema = z.object({
  heading: z.enum(['playfair', 'lora', 'montserrat', 'cormorant', 'poppins']),
  body: z.enum(['inter', 'poppins', 'merriweather', 'noto_sans', 'lora']),
});

const themeSchema = z.object({
  family: z.enum(themeFamilies),
  palette: themePaletteSchema,
  typography: typographySchema,
  mood: z.array(nonEmptyString).min(2).max(4),
});

const heroSceneSchema = z.object({
  type: z.literal('hero'),
  headline: nonEmptyString,
  subline: nonEmptyString.optional(),
});

const countdownSceneSchema = z.object({
  type: z.literal('countdown'),
  targetDateTime: z.string().min(1),
});

const storySceneSchema = z.object({
  type: z.literal('story'),
  paragraphs: z.array(nonEmptyString).min(1),
});

const scheduleItemSchema = z.object({
  name: nonEmptyString,
  date: isoDate,
  time: timeOfDay,
  venue: nonEmptyString,
});

const scheduleSceneSchema = z.object({
  type: z.literal('schedule'),
  items: z.array(scheduleItemSchema).min(1),
});

const venueSceneSchema = z.object({
  type: z.literal('venue'),
  name: nonEmptyString,
  address: nonEmptyString,
  mapsQuery: nonEmptyString,
});

const gallerySceneSchema = z.object({
  type: z.literal('gallery'),
  imageQueries: z.array(nonEmptyString).min(1),
});

const closingSceneSchema = z.object({
  type: z.literal('closing'),
  message: nonEmptyString,
});

const detailsSceneSchema = z.object({
  type: z.literal('details'),
  title: nonEmptyString,
  items: z.array(z.object({ label: nonEmptyString, value: nonEmptyString })).min(1).max(8),
});

const mediaAssetSchema = z.object({
  kind: z.enum(['image', 'video', 'icon']),
  src: z.string().url(),
  alt: nonEmptyString,
  poster: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const sceneSchema = z.discriminatedUnion('type', [
  heroSceneSchema,
  countdownSceneSchema,
  storySceneSchema,
  scheduleSceneSchema,
  venueSceneSchema,
  gallerySceneSchema,
  detailsSceneSchema,
  closingSceneSchema,
]);

const siteSpecSchema = z.object({
  version: z.literal(1),
  event: eventSchema,
  ceremonies: z.array(ceremonySchema).optional(),
  theme: themeSchema,
  scenes: z.array(sceneSchema).min(2),
  motion: z.object({
    preset: z.enum(motionPresets),
    intensity: z.enum(motionIntensities),
  }),
  interaction: z.enum(['petalfall', 'sparkles', 'none']).optional(),
  sound: z
    .object({
      enabled: z.boolean().default(false),
      track: z.string().min(1).optional(),
    })
    .optional(),
  copy: z.record(z.string(), z.string()),
  sharing: z.object({
    title: nonEmptyString,
    description: nonEmptyString,
    themeColor: hexColor,
  }),
  media: z.object({
    hero: mediaAssetSchema.optional(),
    gallery: z.array(mediaAssetSchema).max(8).optional(),
    ambientVideo: mediaAssetSchema.optional(),
  }).optional(),
});

export type SiteSpec = z.infer<typeof siteSpecSchema>;

const planSectionTypes = ['hero', 'countdown', 'story', 'schedule', 'venue', 'gallery', 'details', 'closing'] as const;

const invitationPlanSchema = z.object({
  version: z.literal(1),
  interpretation: z.object({
    occasion: z.enum(eventTypes),
    title: nonEmptyString,
    date: isoDate,
    time: timeOfDay,
    timezone: nonEmptyString,
    venue: nonEmptyString,
    address: nonEmptyString.optional(),
    hosts: z.array(nonEmptyString).min(1),
    unknowns: z.array(nonEmptyString).max(8),
  }),
  language: z.enum(languages),
  copy: z.object({
    heroHeadline: nonEmptyString,
    heroSubline: nonEmptyString.optional(),
    welcome: nonEmptyString,
    story: z.array(nonEmptyString).max(4),
    closing: nonEmptyString,
  }),
  ceremonies: z.array(ceremonySchema).max(12),
  guestInfo: z.array(z.object({ label: nonEmptyString, value: nonEmptyString })).max(8),
  sections: z.array(z.enum(planSectionTypes)).min(2).max(7),
  visualDirection: z.object({
    family: z.enum(themeFamilies),
    mood: z.array(nonEmptyString).min(2).max(4),
    palette: themePaletteSchema,
    typography: typographySchema,
    motion: z.object({
      preset: z.enum(motionPresets),
      intensity: z.enum(motionIntensities),
    }),
    interaction: z.enum(['petalfall', 'sparkles', 'none']),
    imageQueries: z.array(nonEmptyString).max(6),
  }),
});

export type InvitationPlan = z.infer<typeof invitationPlanSchema>;

const intakeQuestionSchema = z.object({
  id: nonEmptyString,
  question: nonEmptyString,
  reason: nonEmptyString,
  required: z.boolean(),
  input: z.enum(['single', 'multiple', 'freeform']),
  options: z.array(nonEmptyString).max(8).optional(),
});

const briefIntakeSchema = z.object({
  version: z.literal(1),
  ready: z.boolean(),
  occasion: z.enum(eventTypes),
  known: z.object({
    title: nonEmptyString.optional(),
    date: isoDate.optional(),
    time: timeOfDay.optional(),
    timezone: nonEmptyString.optional(),
    venue: nonEmptyString.optional(),
    address: nonEmptyString.optional(),
    hosts: z.array(nonEmptyString).max(8),
    guestNotes: z.array(nonEmptyString).max(8),
    designPreferences: z.object({
      style: nonEmptyString.optional(),
      mood: z.array(nonEmptyString).max(4),
      copyTone: nonEmptyString.optional(),
      imagery: nonEmptyString.optional(),
      motion: nonEmptyString.optional(),
    }),
  }),
  questions: z.array(intakeQuestionSchema).max(10),
});

export type BriefIntake = z.infer<typeof briefIntakeSchema>;

export function validateSpec(input: unknown): { ok: true; spec: SiteSpec } | { ok: false; errors: string[] } {
  const parsed = siteSpecSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      const snippet = issue.message.trim();
      return `${path}: ${snippet}`;
    });

    return { ok: false, errors };
  }

  return { ok: true, spec: parsed.data };
}

export function validateInvitationPlan(input: unknown): { ok: true; plan: InvitationPlan } | { ok: false; errors: string[] } {
  const parsed = invitationPlanSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message.trim()}`;
    });

    return { ok: false, errors };
  }

  return { ok: true, plan: parsed.data };
}

export function validateBriefIntake(input: unknown): { ok: true; intake: BriefIntake } | { ok: false; errors: string[] } {
  const parsed = briefIntakeSchema.safeParse(input);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message.trim()}`;
    });

    return { ok: false, errors };
  }

  return { ok: true, intake: parsed.data };
}

export const SPEC_JSON_EXAMPLE: SiteSpec = {
  version: 1,
  event: {
    type: 'wedding',
    title: 'Aarav & Meher',
    date: '2026-12-14',
    time: '18:30',
    timezone: 'Asia/Kolkata',
    venue: 'The Royal Palace',
    address: 'Connaught Place, New Delhi',
    hosts: ['The Sharma Family', 'The Kapoor Family'],
    language: 'hinglish',
  },
  ceremonies: [
    { name: 'Haldi', date: '2026-12-12', time: '10:00', venue: 'Sharma Villa' },
    { name: 'Mehendi', date: '2026-12-13', time: '17:00', venue: 'Mela Grounds' },
    { name: 'Sangeet', date: '2026-12-14', time: '19:00', venue: 'The Royal Palace' },
  ],
  theme: {
    family: 'floral',
    palette: {
      primary: '#7C1D1D',
      secondary: '#D4AF37',
      accent: '#F7E7C6',
      background: '#FFF8F1',
      text: '#2B1D1A',
    },
    typography: {
      heading: 'playfair',
      body: 'poppins',
    },
    mood: ['royal', 'warm', 'vibrant'],
  },
  scenes: [
    { type: 'hero', headline: 'Join us for a celebration of love', subline: 'December 14 · New Delhi' },
    { type: 'countdown', targetDateTime: '2026-12-14T18:30:00+05:30' },
    { type: 'story', paragraphs: ['A wedding woven with laughter, family, and music.', 'We would be delighted to celebrate with you.'] },
    { type: 'schedule', items: [{ name: 'Haldi', date: '2026-12-12', time: '10:00', venue: 'Sharma Villa' }] },
    { type: 'venue', name: 'The Royal Palace', address: 'Connaught Place, New Delhi', mapsQuery: 'The Royal Palace New Delhi' },
    { type: 'closing', message: 'We look forward to celebrating with you!' },
  ],
  motion: { preset: 'drift', intensity: 'medium' },
  interaction: 'sparkles',
  sound: { enabled: false },
  copy: {
    '0': 'Aarav & Meher',
    '1': 'We are delighted to celebrate with you',
    '2': 'A story of love, laughter, and family',
    '3': 'Your presence makes our memories complete',
    '4': 'Come celebrate with us in New Delhi',
    '5': 'Thank you for being part of our joy',
  },
  sharing: {
    title: 'Aarav & Meher Wedding',
    description: 'Join us for a joyful celebration in New Delhi.',
    themeColor: '#7C1D1D',
  },
};

export const siteSpec = siteSpecSchema;
export const invitationPlan = invitationPlanSchema;
export const briefIntake = briefIntakeSchema;
