import { describe, expect, it } from 'vitest';

import { MemoryProjectStore } from './index.js';

describe('MemoryProjectStore', () => {
  it('persists and retrieves a project record', async () => {
    const store = new MemoryProjectStore();
    const project = {
      id: '00000000-0000-0000-0000-000000000001',
      sourcePrompt: 'A birthday invitation',
      language: 'english',
      spec: {} as never,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    await store.saveProject(project);
    expect(await store.getProject(project.id)).toEqual(project);
    expect(await store.getProject('00000000-0000-0000-0000-000000000002')).toBeNull();
  });
});
