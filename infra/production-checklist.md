# Production checklist

## Render setup

- [ ] Create a Render Blueprint from `render.yaml`, or create a Docker web service manually.
- [ ] Set the secret `DATABASE_URL` to the existing TigerData/Timescale connection string.
- [ ] Set the secret `DB_PASSWORD` to the matching TigerData database password.
- [ ] Set the secret `BACKBOARD_API_KEY`.
- [ ] Set the secret `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` only when DNS publishing is enabled.
- [ ] Set `SENTRY_DSN` only if Sentry is configured for this environment.
- [ ] Confirm Render uses the repository root as the Docker build context.
- [ ] Confirm the service health check is `GET /healthz`.

## Required external setup

- [ ] Deploy the container with a managed HTTPS host.
- [ ] Set `DATABASE_URL` to a production Postgres/Timescale connection.
- [ ] Set `BACKBOARD_API_KEY`, `BAKEOFF_MODELS`, and `BACKBOARD_LLM_PROVIDER`.
- [ ] Set `SENTRY_DSN` only after confirming prompt contents are not sent as event context.
- [ ] Keep `DNS_DRY_RUN=true` until a staging publish has been verified.
- [ ] Use separate staging and production credentials.
- [ ] Rotate any credentials that were used during development.

## Release verification

- [ ] `GET /healthz` returns `{"ok":true}`.
- [ ] `GET /readyz` reports `database:"configured"`.
- [ ] Submit one English brief and verify a persisted invite URL.
- [ ] Submit one Hinglish brief and verify the language preference response before generation.
- [ ] Reload the invite URL from a second process or instance.
- [ ] Verify the rendered HTML has no unescaped model text.
- [ ] Run a Cloudflare read-only check and one DNS dry-run.
- [ ] Confirm Backboard usage and cost for the staging run.

## Not production-ready yet

Authentication, billing, object storage, custom-domain automation, distributed rate limiting,
background job queues, and automated database migrations still need implementation before
opening the service to public traffic.
