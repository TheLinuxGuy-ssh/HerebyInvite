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
});
