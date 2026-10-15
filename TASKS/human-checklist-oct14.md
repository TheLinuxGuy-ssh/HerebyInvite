# Human Checklist — Oct 14 (TODAY)

Target by end of day: promos claimed, herebyinvited.tech registered and delegated to
Cloudflare, all partner accounts live, .env seeded, GitHub repo pushed, first-user
outreach sent. Budget ~2–3 hours. Items marked [BLOCKS] gate tomorrow's work.

## 1. Claim all Hacktoberfest promos [first]
- Go to https://hacktoberfest.com/my/promos
- Claim: Tinker, Render, Backboard, .tech domain, DigitalOcean (claim everything offered)
- Record each promo/credit amount in the report-back below

## 2. Register the domain [BLOCKS — do immediately after promos]
- herebyinvited.tech was confirmed UNREGISTERED this morning. Register it via the
  .tech promo before anything else. Fallback if taken: hereby.tech
- Free first year; renews at $29.99/yr

## 3. Delegate DNS to Cloudflare [BLOCKS — start early, propagation takes time]
- Cloudflare (existing account): Add a site → herebyinvited.tech → Free plan
- Cloudflare assigns 2 nameservers. Copy them.
- At the .tech registrar panel: set Custom Nameservers to Cloudflare's pair
- Zone status shows "Pending" until delegation completes (usually minutes, up to hours).
  Do NOT wait idle — continue with steps 4–9 while it propagates.

## 4. Create the scoped Cloudflare API token [after step 3 form is submitted]
- Profile → API Tokens → Create Token → Custom token:
  - Permissions: Zone / DNS / Edit, and Zone / Zone / Read
  - Zone Resources: Include → Specific zone → herebyinvited.tech
- Copy the token. Copy the Zone ID (zone Overview page, right sidebar).

## 5. Register fresh accounts
- DigitalOcean: confirm the credit appears after signup
- Render: plain signup
- Backboard: sign up at the hackathon page, pick the "Unified API" path, copy the
  API key. Then open the billing/credits page and answer the CRITICAL question:
  does the Hacktoberfest credit cover model INFERENCE, or only memory operations?
  Do not enable memory features anywhere (billed per operation).
- Tinker: claim promo, create account, obtain API key
- Tiger Data (Neon): create project "hereby", then in the SQL editor run:
  CREATE EXTENSION vector;  — copy the pooled connection string
- Sentry: create org + a Node project, copy the DSN

## 6. Seed .env (never commit it, never paste values into chat)
- Copy .env.example (created by Copilot in session 1) to .env at repo root and fill:
  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, BACKBOARD_API_KEY, TINKER_API_KEY,
  DATABASE_URL, SENTRY_DSN

## 7. GitHub repo
- Create PUBLIC repo named "hereby" under your account, push the local scaffold
  Copilot produced today. Commit history must live inside Oct 12–18 (it does: we
  start today).

## 8. First-user outreach (lock someone by Oct 16 evening)
- Message 2–3 candidates today with a real upcoming event (birthday, roka, wedding,
  anniversary). Ask for: willingness to try it around Oct 17, a short screen-record
  OK, and permission to quote them (first name only is fine).

## 9. Optional if time remains
- Install llama.cpp (or Ollama) on the Proxmox host if not present. The throughput
  benchmark runs tomorrow.

## REPORT BACK (no secrets — keys stay in .env only)
1. Promo/credit amounts for: Tinker, Render, Backboard, DigitalOcean, .tech
2. Backboard verdict: credit covers inference / memory only / both
3. Domain registered: yes/no, exact name
4. Cloudflare zone status: Pending / Active, nameserver pair noted
5. DigitalOcean credit confirmed: yes/no
6. First-user candidates shortlisted: who, what event
