import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { createProjectStore, type ProjectStore } from '@hereby/db';
import { buildLanguageFollowupQuestion, detectPromptLanguage } from '@hereby/models';
import { renderSite } from '@hereby/renderer';
import { analyzeBrief, generateSite } from '@hereby/worker';

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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hereby — Make it yours</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#251f1b;background:#fffaf4}*{box-sizing:border-box}body{margin:0}main{max-width:760px;margin:auto;padding:clamp(2rem,8vw,6rem) 1.25rem}.kicker{color:#9b6b36;text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;font-weight:700}h1{font:500 clamp(2.8rem,8vw,5.8rem)/.95 Georgia,serif;color:#6e2727;max-width:650px;margin:.7rem 0 1.25rem}p{line-height:1.7;max-width:620px}.card{margin-top:2.5rem;padding:clamp(1.2rem,4vw,2rem);border:1px solid #ead8c5;border-radius:1.2rem;background:#fff;box-shadow:0 1.5rem 4rem #6e272712}label{display:block;margin-bottom:.6rem;font-weight:700}textarea,input,select{width:100%;border:1px solid #d9c4ad;border-radius:.7rem;padding:.85rem;background:#fffaf4;color:inherit;font:inherit}textarea{min-height:170px;resize:vertical}.field{margin:1.2rem 0}.hint{font-size:.9rem;color:#745f50}.question{padding:1rem 0;border-top:1px solid #ead8c5}button{border:0;border-radius:999px;padding:.9rem 1.25rem;background:#6e2727;color:#fff;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.status{margin-top:1rem;color:#6e2727}.hidden{display:none}</style></head><body><main><p class="kicker">A living invitation, made around your story</p><h1>Give your celebration a shape people can feel.</h1><p>Tell us what you know. Hereby will understand the occasion, notice what guests still need, and ask only the questions that make the final invitation more personal and useful.</p><section class="card"><form id="brief-form"><div class="field"><label for="prompt">Describe your celebration</label><textarea id="prompt" maxlength="4000" required placeholder="We are getting married in Jaipur..."></textarea><p class="hint">Names, dates, rituals, venue, dress code, travel notes, RSVP details, and the feeling you want are all useful.</p></div><div id="language-panel" class="field hidden"><label for="language">How should the guest-facing copy feel?</label><select id="language"><option value="hinglish">Hinglish in selected sections</option><option value="en">Fully English</option><option value="hi">Fully Hindi</option></select></div><div id="questions" class="field hidden"></div><button id="submit" type="submit">Shape my invitation</button><div id="status" class="status" role="status" aria-live="polite"></div></form></section></main><script src="/home.js" defer></script></body></html>`;
}

function homeScript(): string {
  return `const form=document.querySelector('#brief-form'),promptInput=document.querySelector('#prompt'),languagePanel=document.querySelector('#language-panel'),languageInput=document.querySelector('#language'),questions=document.querySelector('#questions'),submit=document.querySelector('#submit'),status=document.querySelector('#status');let languagePreference;function showQuestions(items){questions.innerHTML='<p><strong>Let us make this genuinely yours.</strong></p>'+items.map((item,index)=>'<div class="question"><label for="answer-'+index+'">'+item.question+(item.required?' *':'')+'</label><p class="hint">'+item.reason+'</p><input id="answer-'+index+'" data-question-id="'+item.id+'" '+(item.required?'required':'')+'></div>').join('');questions.classList.remove('hidden')}form.addEventListener('submit',async(event)=>{event.preventDefault();submit.disabled=true;status.textContent='Reading your brief...';if(!languagePanel.classList.contains('hidden'))languagePreference=languageInput.value;const answers={};document.querySelectorAll('[data-question-id]').forEach((input)=>{if(input.value.trim())answers[input.dataset.questionId]=input.value.trim()});const body={prompt:promptInput.value.trim(),...(languagePreference?{languagePreference}:{}),...(Object.keys(answers).length?{answers}:{})};try{const response=await fetch('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await response.json();if(data.requiresLanguagePreference){languagePanel.classList.remove('hidden');status.textContent=data.question;return}if(data.requiresDetails){showQuestions(data.questions);status.textContent='A few details will help us make this informative for your guests.';return}if(data.previewUrl){status.innerHTML='<a href="'+data.previewUrl+'">Open your invitation preview</a>';submit.remove();return}status.textContent=data.error||'Something went wrong.'}catch(error){status.textContent='We could not reach the invitation studio. Please try again.'}finally{submit.disabled=false}});`;
}

function parseAnswers(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const answers = Object.entries(input as Record<string, unknown>).filter(
    ([key, value]) => key.length <= 80 && typeof value === 'string' && value.trim().length <= 1000,
  );
  if (answers.length === 0) return undefined;
  return Object.fromEntries(answers.map(([key, value]) => [key, (value as string).trim()]));
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
    if (request.method === 'GET' && request.url === '/home.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      response.end(homeScript());
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
      let body: { prompt?: unknown; languagePreference?: unknown; answers?: unknown };
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
      const answers = parseAnswers(body.answers);
      if (!answers) {
        const intakeResult = await analyzeBrief(body.prompt);
        if (!intakeResult.intake.ready) {
          sendJson(response, 200, {
            requiresDetails: true,
            questions: intakeResult.intake.questions,
            known: intakeResult.intake.known,
          });
          return;
        }
      }
      const result = await generateSite({ prompt: body.prompt, languagePreference, answers });
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
