# Hereby

Hereby turns an event description into an intake-reviewed, validated invitation-site spec, then renders that spec into a responsive invite site. The core idea is spec-first: an LLM never writes HTML directly; it interprets the brief, asks for missing content and design direction, emits a strict JSON `SiteSpec`, and the renderer consumes that contract. Optional media providers can search stock imagery or generate hosted images through NVIDIA NIM.

## Monorepo layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Minimal web/API vertical slice for creation, preview, and public invite routes |
| `apps/worker` | Model-backed SiteSpec generation with bounded validation retries |
| `packages/spec` | The JSON schema contract and validation logic |
| `packages/dns` | Cloudflare DNS client with idempotent record handling |
| `packages/models` | OpenAI-compatible model client and bake-off harness |
| `packages/media` | Provider-neutral stock search and NVIDIA NIM media adapters |
| `packages/renderer` | Deterministic HTML renderer for validated SiteSpecs |
| `packages/scenes` | Future primitive scene definitions |
| `packages/db` | Future persistence layer |
| `training` | Model training and experimentation artifacts |
| `infra` | Infrastructure and deployment scaffolding |
| `prompts` | Prompt templates and example briefs |
| `results` | Generated bake-off outputs |

## Quickstart

```bash
pnpm install
pnpm bakeoff -- --models mock-model --runs 1
pnpm test
pnpm dev:web
```

The first vertical slice runs without a database and stores generated previews in memory.
When `DATABASE_URL` is set, the web process uses Postgres and initializes the `projects`
table at startup. The current service includes health/readiness endpoints and a basic
per-process generation rate limit. See `infra/production-checklist.md` before deployment.

## Render deployment

This repository includes a Render Blueprint in `render.yaml`. In Render:

1. Create a new Blueprint and select this repository.
2. Review the `hereby-web` Docker web service.
3. Set the secret `DATABASE_URL` to the existing TigerData/Timescale connection string.
4. Set the secret `DB_PASSWORD` to the matching TigerData database password.
5. Set the secret `BACKBOARD_API_KEY`.
6. Keep `DNS_DRY_RUN=true` until staging publishing has been verified.
7. Deploy and confirm `/healthz` returns `{"ok":true}` and `/readyz` reports a configured database.

The Blueprint intentionally does not provision a database or upload any secret values.
Use the existing TigerData/Timescale database and enter its connection string and password
in Render's secret environment settings. Render only hosts the web service.

For the complete GitHub connection, secret setup, verification, and custom-domain steps,
see `infra/render-deployment.md`.

## Environment contract

The repo uses the following environment variables:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ZONE_NAME` (defaults to `herebyinvited.tech`)
- `DNS_DRY_RUN` (defaults to `true`)
- `BACKBOARD_API_KEY`
- `BACKBOARD_BASE_URL` (optional SDK endpoint override; defaults to Backboard's native API)
- `BAKEOFF_MODELS`
- `BACKBOARD_LLM_PROVIDER` (optional provider routing, such as `anthropic`)
- `BAKEOFF_RUNS` (default `1`)
- `BAKEOFF_MAX_PROMPTS` (default to the full prompt set; keep it low to conserve Hacktoberfest credits)
- `TINKER_API_KEY`
- `DATABASE_URL`
- `SENTRY_DSN`
- `APP_ENV`

For cost-sensitive runs, keep `BAKEOFF_MODELS` to one valid Backboard model and set `BAKEOFF_MAX_PROMPTS=1` for validation passes. The official Backboard SDK manages the API URL and authentication; the CLI refuses remote model calls unless `BACKBOARD_API_KEY` is configured.

See `.env.example` for the committed defaults and empty placeholders.

## Post-deadline commits

This section is intentionally reserved for post-deadline contest commits and follow-up work.
