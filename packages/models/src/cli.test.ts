import { createServer } from 'node:http';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { SPEC_JSON_EXAMPLE } from '@hereby/spec';

import { buildLanguageFollowupQuestion, detectPromptLanguage } from './client.js';
import { run } from './cli.js';

const repoRoot = join(process.cwd());

const buildSpec = () => ({
  ...SPEC_JSON_EXAMPLE,
  event: {
    ...SPEC_JSON_EXAMPLE.event,
    title: 'Aarav aur Meher ki shaadi',
    language: 'hinglish',
  },
  copy: {
    '0': 'Aarav aur Meher',
    '1': 'Aapka swagat hai',
    '2': 'Family aur pyaar ki mehfil',
    '3': 'Aapka hona zaroori hai',
    '4': 'The Royal Palace, New Delhi',
    '5': 'Shukriya',
  },
  sharing: {
    ...SPEC_JSON_EXAMPLE.sharing,
    title: 'Aarav aur Meher ki shaadi',
    description: 'A lovely celebration with family and friends.',
  },
});

describe('language detection', () => {
  it('keeps English prompts English unless they already contain Hinglish', () => {
    expect(detectPromptLanguage('Plan a birthday invitation with elegant floral styling')).toBe('english');
    expect(buildLanguageFollowupQuestion('Plan a birthday invitation with elegant floral styling')).toBeNull();
  });

  it('asks for language preference only when Hinglish is actually used', () => {
    const input = 'Bhai ki shaadi hai, royal theme chahiye, family mostly Hinglish bolti hai';
    expect(detectPromptLanguage(input)).toBe('hinglish');
    expect(buildLanguageFollowupQuestion(input)).toContain('Hinglish');
  });
});

describe('bakeoff CLI', () => {
  let server: ReturnType<typeof createServer> | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it('runs against a mock backend and writes a result file', async () => {
    let requestBody = '';
    server = createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/api/threads/messages') {
        request.on('data', (chunk: Buffer) => { requestBody += chunk.toString('utf8'); });
        request.on('end', () => {
          const spec = buildSpec();
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              content: JSON.stringify(spec),
              input_tokens: 120,
              output_tokens: 80,
              total_tokens: 200,
            }),
          );
        });
        return;
      }

      response.writeHead(404);
      response.end('not found');
    });

    await new Promise<void>((resolve) => {
      server?.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server?.address();
    const actualPort = typeof address === 'object' && address !== null && 'port' in address ? address.port : 0;

    const result = await run({
      argv: ['node', 'cli.ts', '--models=mock-model', '--runs=1'],
      env: {
        ...process.env,
        BACKBOARD_BASE_URL: `http://127.0.0.1:${actualPort}/api`,
        BACKBOARD_API_KEY: 'test-key',
      },
      logger: {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });

    expect(result.rows.length).toBeGreaterThan(0);
    expect(requestBody).not.toContain('Follow-up question:');
    expect(result.jsonPath).toContain('bakeoff-');
    expect(result.markdownPath).toContain('bakeoff-');

    const files = readdirSync(join(repoRoot, 'results'));
    const bakeoffFiles = files.filter((file) => file.startsWith('bakeoff-') && (file.endsWith('.json') || file.endsWith('.md')));
    expect(bakeoffFiles.length).toBeGreaterThanOrEqual(2);
  }, 20000);
});
