# Session 01 — Repo Scaffold, Spec Schema, DNS Client, Model Bake-off Harness

You are implementing Hereby, an entry for DEV's Hacktoberfest Open-Source AI
Challenge Week 2 (Side Hustle). Core thesis: a person describes an event in one
sentence (often in Hindi/Hinglish); an open-weight model extracts the details into
a VALIDATED site specification (strict JSON); hand-designed components render the
spec into a static invitation site; the site publishes automatically at
name.herebyinvited.tech via the Cloudflare API. Models never write HTML; they emit
specs. The schema is the contract between models, validator, and renderer.

This session has NO external dependencies (no API keys needed to build; dry-run
mode only). Work in the current directory. Complete, production-ready code. No
comments unless a block is genuinely non-obvious. Conventional commits, one per
deliverable, all today (commit history inside the contest window is required).

## Conventions
- pnpm monorepo, TypeScript strict everywhere, Node >= 22, ESM
- Vitest for tests. ESLint (typescript-eslint strict) + Prettier. No comments.
- Errors: typed result objects at package boundaries, exceptions only for
  programmer errors. Retries: exponential backoff on 429/5xx for HTTP clients.
- Secrets ONLY via env vars. .env is gitignored. Never log secret values.

## Deliverables

### D1 — Monorepo scaffold
- Root: package.json (name "hereby", private), pnpm-workspace.yaml, tsconfig.base.json
  (strict, bundler resolution), eslint config, prettier, vitest workspace config,
  .gitignore (node_modules, dist, .env, results/, .DS_Store), MIT LICENSE (copyright
  "Rohan Sharma"), .github/workflows/ci.yml running lint + typecheck + test on push.
- Directories (create future-session dirs with a one-line README stub each):
  apps/web, apps/worker, packages/spec, packages/dns, packages/models,
  packages/renderer, packages/scenes, packages/db, training/, infra/, prompts/,
  results/ (gitignored)
- D1 implementation lives only where this session's packages go; other dirs stay
  stubs.

### D2 — packages/spec (the contract; most important deliverable)
Zod schema v1 for SiteSpec, designed for compact model output:
- version: literal 1
- event: { type: enum[wedding, engagement, roka, birthday, anniversary,
  housewarming, baby_shower, other]; title; date (ISO); time ("HH:mm"); timezone
  (IANA); venue; address?; hosts: string[]; language: enum[en, hi, hinglish] }
- ceremonies?: { name; date; time; venue }[]  (weddings/roka)
- theme: { family: enum[floral, playful]; palette: { primary, secondary, accent,
  background, text } (hex); typography: { heading, body } from a small pairing
  enum; mood: string[] (2–4 keywords) }
- scenes: ordered, min 2: discriminated union by type:
  hero { headline; subline? } | countdown { targetDateTime } | story { paragraphs:
  string[] } | schedule { items: { name; date; time; venue }[] } | venue { name;
  address; mapsQuery } | gallery { imageQueries: string[] } | closing { message }
- motion: { preset: enum[none, drift, pulse, rise]; intensity:
  enum[subtle, medium, lively] }
- interaction?: enum[petalfall, sparkles, none]
- sound?: { enabled (default false); track? }
- copy: per-scene short strings in event.language, keyed by scene index
- sharing: { title; description; themeColor }
Validator API exported from package root:
- validateSpec(input: unknown): { ok: true; spec: SiteSpec } | { ok: false; errors:
  string[] }  (field-level, human-readable errors suited for model retry prompts)
- Strip unknown keys silently; enforce required structure strictly.
- SPEC_JSON_EXAMPLE: one compact example spec exported for use in prompts.
Tests: 3 fixtures (fixtures/wedding-hinglish.json with haldi/mehendi/sangeet
ceremonies, maroon-gold floral theme; fixtures/birthday-en.json playful Ghibli
25th birthday; fixtures/anniversary-en.json elegant Ooty old-Bollywood theme)
all pass; mutation tests: missing required field, bad enum, bad hex, empty scenes
→ rejected with precise errors.

### D3 — packages/dns (Cloudflare client, idempotent)
- Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_ZONE_NAME
  (default herebyinvited.tech), DNS_DRY_RUN (default true)
- Client (fetch-based, no SDK dependency): ensureRecord({name, type: "A"|"CNAME",
  content, proxied: true, ttl: 1}) — checks existing records first, creates only
  if missing (never duplicates on retry), updates content if changed; deleteRecord;
  listRecords. 429/5xx retry with backoff. Typed errors include Cloudflare error
  codes. DRY_RUN mode logs intended mutations and returns simulated success.
- Tests with injected fetch: create-when-missing, no-duplicate-when-present,
  update-when-changed, retry-on-429, dry-run behavior.

### D4 — packages/models (Backboard client + bake-off harness)
- BackboardClient: OpenAI-compatible chat completions against configurable
  BACKBOARD_BASE_URL + BACKBOARD_API_KEY; models passed per call; returns content,
  usage tokens, wall time. Retry on 429/5xx.
- Bake-off harness CLI: pnpm bakeoff -- --models m1,m2 [--runs N]
  - Reads prompts/hinglish-prompts.jsonl (5 briefs below, one per line:
    { id, text })
  - For each model × brief: system prompt = "You are an invitation site director.
    Output ONLY a JSON site specification matching this shape:" + SPEC_JSON_EXAMPLE
    (+ rules: guest-facing copy in the requested language, compact, no markdown).
    temperature 0.2.
  - Measures: JSON parse rate, validateSpec pass rate with first error, wall
    latency, usage tokens, cost (from packages/models/prices.json, an editable
    { model: { input, output } } USD/M table; cost prints n/a if missing),
    copy-language sanity (Devanagari present for hi/hinglish briefs).
  - Writes results/bakeoff-<timestamp>.json and a results/bakeoff-<timestamp>.md
    markdown results table. Errors politely if BAKEOFF_MODELS env or --models is
    empty.
- prompts/hinglish-prompts.jsonl — exactly these five briefs:
  1. id bday-ghibli: "Meri behen ka 25th birthday hai, wo Studio Ghibli dekhna
     pasand karti hai, ghar pe chhota party hai, mostly Hindi speaking family"
  2. id wedding-royal: "Bhai ki shaadi 14 December ko hai, Delhi mein. Haldi,
     mehendi, sangeet sab hain. Family mostly Hinglish bolti hai. Royal
     maroon-gold theme chahiye"
  3. id anniv-ooty: "25th anniversary for my parents, they met in Ooty, love old
     Bollywood songs, formal dinner at a hotel, English speaking guests"
  4. id housewarming: "Naya flat Bangalore mein, doston ke liye housewarming
     party, casual vibe, plants aur minimal theme, Hinglish invite"
  5. id roka-floral: "Cousin ki roka ceremony hai, Punjabi family, Gurgaon mein
     lunch, yellow floral theme, invite Hinglish mein hona chahiye"

### D5 — .env.example (root, committed)
All keys with empty values and a one-line comment each:
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_ZONE_NAME=herebyinvited.tech,
DNS_DRY_RUN=true, BACKBOARD_API_KEY, BACKBOARD_BASE_URL, BAKEOFF_MODELS=,
TINKER_API_KEY=, DATABASE_URL=, SENTRY_DSN=, APP_ENV=local

### D6 — README
Short: what Hereby is, the spec-plus-primitives thesis, monorepo layout table,
quickstart (pnpm install, pnpm bakeoff, pnpm test), env contract summary, a
"Post-deadline commits" section placeholder (required by contest rules).

## Out of scope (do NOT build): renderer, scenes, chat app, agent flow, DB,
worker, Tinker scripts, nginx configs. Stub dirs only.

## Acceptance (all must pass before you finish)
pnpm install && pnpm lint && pnpm typecheck && pnpm test — clean.
Fixtures validate; mutation cases rejected; DNS client passes mock tests in
dry-run default; bakeoff CLI runs against a mock server in tests; .env.example
committed; MIT LICENSE present; CI workflow present; git log shows one commit
per deliverable D1–D6.
