import { describe, expect, it } from 'vitest';

import { SPEC_JSON_EXAMPLE } from '@hereby/spec';

import { renderSite } from './index.js';

describe('renderSite', () => {
  it('renders a complete escaped invitation document', () => {
    const spec = {
      ...SPEC_JSON_EXAMPLE,
      sharing: { ...SPEC_JSON_EXAMPLE.sharing, title: '<Invite>' },
    };
    const html = renderSite(spec);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('&lt;Invite&gt;');
    expect(html).not.toContain('<title><Invite>');
    expect(html).toContain('The Royal Palace');
  });

  it('renders hosted media with accessible attributes when supplied', () => {
    const spec = {
      ...SPEC_JSON_EXAMPLE,
      scenes: [...SPEC_JSON_EXAMPLE.scenes, { type: 'gallery' as const, imageQueries: ['celebration'] }],
      media: {
        hero: { kind: 'image' as const, src: 'https://cdn.example.com/hero.jpg', alt: 'Warm floral arch' },
        gallery: [{ kind: 'image' as const, src: 'https://cdn.example.com/gallery.jpg', alt: 'Guests at sunset' }],
      },
    };
    const html = renderSite(spec);

    expect(html).toContain('https://cdn.example.com/hero.jpg');
    expect(html).toContain('alt="Warm floral arch"');
    expect(html).toContain('https://cdn.example.com/gallery.jpg');
  });
});
