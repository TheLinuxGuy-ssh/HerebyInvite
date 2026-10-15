import { describe, expect, it } from 'vitest';

import type { InvitationPlan } from '@hereby/spec';

import { analyzeBrief, compileInvitationPlan } from './index.js';

const plan: InvitationPlan = {
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
  ceremonies: [
    { name: 'Sangeet', date: '2026-12-13', time: '19:00', venue: 'Mela Grounds' },
  ],
  guestInfo: [
    { label: 'Dress code', value: 'Festive Indian' },
  ],
  sections: ['hero', 'countdown', 'story', 'schedule', 'venue', 'closing'],
  visualDirection: {
    family: 'floral',
    mood: ['warm', 'joyful'],
    palette: { primary: '#7C1D1D', secondary: '#D4AF37', accent: '#F7E7C6', background: '#FFF8F1', text: '#2B1D1A' },
    typography: { heading: 'playfair', body: 'poppins' },
    motion: { preset: 'drift', intensity: 'medium' },
    interaction: 'sparkles',
    imageQueries: [],
  },
};

describe('compileInvitationPlan', () => {
  it('preserves the director-selected section order and content', () => {
    const spec = compileInvitationPlan(plan);

    expect(spec.scenes.map((scene) => scene.type)).toEqual(['hero', 'countdown', 'story', 'schedule', 'venue', 'closing']);
    expect(spec.event.title).toBe('Aarav & Meher');
    expect(spec.scenes[0]).toMatchObject({ type: 'hero', headline: 'Join us for a celebration of love' });
  });

  describe('analyzeBrief', () => {
    it('asks for critical facts instead of accepting an incomplete brief', async () => {
      const result = await analyzeBrief(
        'We are planning a beautiful wedding with a royal feeling.',
        {
          complete: () => Promise.resolve({
            content: JSON.stringify({
              version: 1,
              ready: true,
              occasion: 'wedding',
              known: {
                hosts: [],
                guestNotes: [],
                designPreferences: { mood: [] },
              },
              questions: [],
            }),
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            wallTimeMs: 1,
          }),
        },
      );

      expect(result.intake.ready).toBe(false);
      expect(result.intake.questions.map((question) => question.id)).toEqual(
        expect.arrayContaining(['event-date', 'event-time', 'event-venue', 'hosts', 'design-style', 'design-mood', 'copy-tone', 'imagery', 'motion']),
      );
      const styleQuestion = result.intake.questions.find((question) => question.id === 'design-style');
      expect(styleQuestion?.input).toBe('single');
      expect(styleQuestion?.options).toContain('Editorial and elegant');
      expect(result.intake.questions.find((question) => question.id === 'design-mood')).toMatchObject({
        input: 'multiple',
      });
    });
  });

  it('rejects sections that have no supporting content', () => {
    expect(() => compileInvitationPlan({
      ...plan,
      sections: ['hero', 'gallery'],
    })).toThrow('gallery section without image queries');
  });
});
