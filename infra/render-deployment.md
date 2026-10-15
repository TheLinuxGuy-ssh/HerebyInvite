# Deploy Hereby to Render from GitHub

## Before connecting Render

1. Push this repository to GitHub.
2. Confirm the repository root contains:
   - `render.yaml`
   - `Dockerfile`
   - `pnpm-lock.yaml`
3. Keep production secrets out of GitHub. Do not commit `.env`.
4. Make sure the TigerData database accepts connections from Render.

## Create the Render deployment

1. Open the Render dashboard.
2. Choose **New > Blueprint**.
3. Connect GitHub and authorize the GitHub account or organization that owns this repository.
4. Select the Hereby repository and the branch to deploy.
5. Render detects `render.yaml` and previews the `hereby-web` service.
6. Review the service before applying it. The service uses the repository `Dockerfile`.
7. Apply the Blueprint.

## Add secrets in Render

Open **hereby-web > Environment** and add the secret values:

- `DATABASE_URL`: the existing TigerData/Timescale connection string
- `DB_PASSWORD`: the matching TigerData database password
- `BACKBOARD_API_KEY`: the Backboard API key
- `CLOUDFLARE_API_TOKEN`: only when DNS publishing is enabled
- `CLOUDFLARE_ZONE_ID`: only when DNS publishing is enabled
- `SENTRY_DSN`: only when Sentry is ready

The Blueprint already sets these non-secret values:

- `APP_ENV=production`
- `NODE_ENV=production`
- `PORT=8787`
- `BACKBOARD_BASE_URL=https://app.backboard.io/api`
- `BACKBOARD_LLM_PROVIDER=anthropic`
- `BAKEOFF_MODELS=claude-haiku-4-5-20251001`
- `CLOUDFLARE_ZONE_NAME=herebyinvited.tech`
- `DNS_DRY_RUN=true`

Click **Save Changes** and deploy the latest commit.

## Verify the deployment

After Render reports the deploy as live, open:

```text
https://<render-service-name>.onrender.com/healthz
https://<render-service-name>.onrender.com/readyz
```

Expected responses:

```json
{"ok":true}
```

```json
{"ok":true,"database":"configured"}
```

The first generation request initializes the project flow and may use one Backboard
inference. Keep testing to one prompt until the staging deployment is confirmed.

## Connect a custom domain later

1. In Render, open **Settings > Custom Domains**.
2. Add the desired hostname, such as `app.herebyinvited.tech`.
3. Copy the DNS target Render provides.
4. Add the record in Cloudflare.
5. Keep Hereby's own DNS automation in dry-run mode until the staging domain works.

Do not point the apex domain at Render until the service and health checks are verified.
