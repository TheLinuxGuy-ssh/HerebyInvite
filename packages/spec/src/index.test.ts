import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateSpec } from './index.js';

const fixturePath = (name: string) => join(process.cwd(), 'packages/spec/fixtures', name);

const loadFixture = (name: string): Record<string, unknown> => {
  const raw = readFileSync(fixturePath(name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
};

describe('validateSpec', () => {
  it('accepts the wedding Hinglish fixture', () => {
    const result = validateSpec(loadFixture('wedding-hinglish.json'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.version).toBe(1);
      expect(result.spec.event.language).toBe('hinglish');
      expect(result.spec.scenes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('accepts the birthday English fixture', () => {
    const result = validateSpec(loadFixture('birthday-en.json'));
    expect(result.ok).toBe(true);
  });

  it('accepts the anniversary English fixture', () => {
    const result = validateSpec(loadFixture('anniversary-en.json'));
    expect(result.ok).toBe(true);
  });

  it('rejects a spec missing a required field', () => {
    const invalid = structuredClone(loadFixture('wedding-hinglish.json'));
    const event = invalid.event as Record<string, unknown>;
    delete event.title;

    const result = validateSpec(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('event.title');
    }
  });

  it('rejects a bad enum value', () => {
    const invalid = structuredClone(loadFixture('wedding-hinglish.json'));
    const event = invalid.event as Record<string, unknown>;
    event.type = 'concert';

    const result = validateSpec(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('event.type');
    }
  });

  it('rejects a bad hex color', () => {
    const invalid = structuredClone(loadFixture('wedding-hinglish.json'));
    const theme = invalid.theme as Record<string, unknown>;
    const palette = theme.palette as Record<string, unknown>;
    palette.primary = 'maroon';

    const result = validateSpec(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('theme.palette.primary');
    }
  });

  it('rejects an empty scenes array', () => {
    const invalid = structuredClone(loadFixture('wedding-hinglish.json'));
    invalid.scenes = [];

    const result = validateSpec(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('scenes');
    }
  });
});
