import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { createProjectStore, type ProjectStore } from '@hereby/db';
import { buildLanguageFollowupQuestion, detectPromptLanguage } from '@hereby/models';
import { renderSite } from '@hereby/renderer';
import { generateSite } from '@hereby/worker';

import { applySecurityHeaders, requestAddress, RequestRateLimiter } from './security.js';

const port = Number(process.env.PORT ?? 8787);
const projectStore: ProjectStore = createProjectStore();
const generationLimiter = new RequestRateLimiter({ windowMs: 60_000, maxRequests: 5 });

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  applySecurityHeaders(response);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    const value: unknown = chunk;
    body += typeof value === 'string' ? value : Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  }
  if (body.length > 100_000) throw new Error('Request body is too large.');
  return JSON.parse(body);
}

function homePage(): string {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hereby</title></head><body><main><h1>Create your invitation</h1><form method="post" action="/api/projects"><label for="prompt">Describe your celebration</label><textarea id="prompt" name="prompt" required maxlength="4000"></textarea><button type="submit">Generate preview</button></form></main></body></html>';
}

export function createWebServer(store: ProjectStore = projectStore) {
  return createServer((request, response) => {
    void handleRequest(request, response, store);
  });
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, store: ProjectStore): Promise<void> {
  try {
    applySecurityHeaders(response);
    if (request.method === 'GET' && request.url === '/healthz') {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'GET' && request.url === '/readyz') {
      sendJson(response, 200, { ok: true, database: process.env.DATABASE_URL ? 'configured' : 'memory' });
      return;
    }
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(homePage());
      return;
    }
    if (request.method === 'POST' && request.url === '/api/projects') {
      if (!generationLimiter.allow(requestAddress(request))) {
        sendJson(response, 429, { error: 'Too many generation requests. Please try again later.' });
        return;
      }
      let body: { prompt?: unknown; languagePreference?: unknown };
      try {
        body = await readBody(request) as { prompt?: unknown; languagePreference?: unknown };
      } catch {
        sendJson(response, 400, { error: 'Request body must be valid JSON and no larger than 100 KB.' });
        return;
      }
      if (typeof body.prompt !== 'string' || body.prompt.trim().length < 3) {
        sendJson(response, 400, { error: 'prompt must be at least 3 characters.' });
        return;
      }
      const language = detectPromptLanguage(body.prompt);
      const languagePreference = body.languagePreference === 'en' || body.languagePreference === 'hi' || body.languagePreference === 'hinglish'
        ? body.languagePreference
        : undefined;
      if (language === 'hinglish' && !languagePreference) {
        sendJson(response, 200, { requiresLanguagePreference: true, question: buildLanguageFollowupQuestion(body.prompt) });
        return;
      }
      const result = await generateSite({ prompt: body.prompt, languagePreference });
      const id = randomUUID();
      await store.saveProject({
        id,
        sourcePrompt: body.prompt,
        language: result.language,
        ...(languagePreference ? { languagePreference } : {}),
        spec: result.spec,
        createdAt: new Date().toISOString(),
      });
      sendJson(response, 201, { id, language: result.language, attempts: result.attempts, previewUrl: `/invite/${id}` });
      return;
    }
    const match = request.url?.match(/^\/invite\/([a-f0-9-]+)$/i);
    const inviteId = match?.[1];
    if (request.method === 'GET' && inviteId) {
      const project = await store.getProject(inviteId);
      if (!project) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Invitation not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      response.end(renderSite(project.spec, { canonicalUrl: `/invite/${inviteId}` }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  } catch (error) {
    console.error('Unhandled web request error.', error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
}

const server = createWebServer();

void Promise.resolve(projectStore.initialize?.()).then(() => {
  server.listen(port, () => console.log(`Hereby web listening on http://localhost:${port}`));
}).catch((error: unknown) => {
  console.error('Database initialization failed.', error);
  process.exitCode = 1;
});
