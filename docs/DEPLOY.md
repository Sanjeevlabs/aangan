# Deploying Aangan to Cloudflare Workers

Aangan runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`). `npm run build` is still a plain `next build`; the Workers build is separate.

| Script | What it does |
|---|---|
| `npm run cf:build` | `next build`, then adapts the output into `.open-next/` (worker + static assets) |
| `npm run cf:preview` | build, then run the worker locally in workerd (wrangler dev) on http://localhost:8787 |
| `npm run cf:deploy` | build, then upload to Cloudflare |

Files: `wrangler.jsonc` (worker name `aangan`, `nodejs_compat`, static assets, daily cron), `open-next.config.ts` (adapter config), `cf-worker.mjs` (worker entry: OpenNext's handler plus the cron handler).

## 1. Account and CLI

1. Create a Cloudflare account. Worker size: the compressed worker is ~2.0 MiB, under both Workers size limits (3 MiB and 10 MiB compressed, depending on the plan).
2. `npx wrangler login` (opens a browser; authorises this machine).
3. `npx wrangler whoami` should list your account. If you have several accounts, set `CLOUDFLARE_ACCOUNT_ID` in your shell.

## 2. Variables and secrets

Nothing secret lives in `wrangler.jsonc`. There are two kinds of variable:

- **Runtime** (read by server code via `process.env`; OpenNext fills `process.env` from the worker's bindings on each request). Set them as secrets: `npx wrangler secret put NAME` (prompts for the value), or in the dashboard under Workers & Pages → aangan → Settings → Variables and Secrets. Plain values can be "Text" variables; keys must be "Secret".
- **Build time** (`NEXT_PUBLIC_*`): Next.js inlines these into the browser bundle during `next build`, so they must be in the environment **of the machine that runs `npm run cf:build`/`cf:deploy`** (shell env or a `.env.production.local` that is never committed). Setting them only as worker secrets does nothing. If you use Cloudflare Workers Builds (Git integration), set them under the build's "Build variables".

For local `cf:preview`, put runtime values in `.dev.vars` (gitignored, same `KEY=value` format as `.env`).

| Variable | Kind | Required | Notes |
|---|---|---|---|
| `SESSION_SECRET` | runtime secret | yes | 32+ random chars. Signs session cookies and seals partner tokens. |
| `CRON_SECRET` | runtime secret | yes | Long random string. The daily cron and any manual GET of `/api/ritual-scan` send `Authorization: Bearer <CRON_SECRET>`. |
| `APP_ORIGIN` | runtime var | yes in production | Your public origin, e.g. `https://aangan.sanjeevlabs.com` (no trailing slash). Pins OAuth redirect URIs and is the URL the cron calls. Not hardcoded anywhere. |
| `MOCK` | runtime var | yes | `false` for live Supabase; `true` only for a demo (see per-isolate note below). |
| `META_API_KEY` | runtime secret | for live AI | Meta model calls. Environment only, never in a file. |
| `BASETEN_API_KEY` | runtime secret | optional | Muse Spark Open failover on Baseten. |
| `MODAL_MUSE_URL`, `MODAL_API_KEY`, `MODAL_MUSE_MODEL` | runtime (key is secret) | optional | Own Muse Spark Open endpoint on Modal; needs URL and key. |
| `MUSE_PROVIDER` | runtime var | optional | `meta` (default), `baseten` or `modal`. |
| `SUPABASE_SECRET_KEY` | runtime secret | live mode | Service-role key. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | **build time** | live mode | Also read server-side, so set it as a runtime var too. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **build time** | live mode | Also set as a runtime var. |
| `NEXT_PUBLIC_AUTH_GOOGLE` | **build time** | optional | `true` shows Google sign-in. |
| `NEXT_PUBLIC_AUTH_PHONE` | **build time** | optional | `true` only with an SMS provider configured in Supabase. |
| `NEXT_PUBLIC_MOCK` | **build time** | optional | `true` with `MOCK=true` so the browser uses the demo code instead of Supabase. |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | **build time** | optional | Browser key; restrict it to your domain in Google Cloud. |
| `PARTNER_SWIGGY`, `PARTNER_ZOMATO`, `PARTNER_URBAN_COMPANY`, `PARTNER_SHOPIFY_GIFTS` | runtime var | optional | `true` turns a partner on (`data/partners.json`). |
| `SWIGGY_CLIENT_ID`, `ZOMATO_CLIENT_ID` | runtime var | optional | Pre-registered OAuth client ids, if a partner needs one. |
| `UCP_AGENT_PROFILE` | runtime var | optional | Overrides the UCP agent profile sent to Shopify. |

Example:

```sh
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put META_API_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put APP_ORIGIN      # e.g. https://aangan.sanjeevlabs.com
npx wrangler secret put MOCK            # false
# build-time values, then deploy
export NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... NEXT_PUBLIC_AUTH_GOOGLE=true
npm run cf:deploy
```

(`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` also need `wrangler secret put` so server routes see them.)

## 3. First deploy

`npm run cf:deploy` creates the worker on first run and prints its `*.workers.dev` URL. Open it and check the home page, then `/?demo=1` on a phone.

## 4. Custom domain

Dashboard → Workers & Pages → aangan → Settings → Domains & Routes → Add → Custom domain. The domain's DNS must be on Cloudflare (add the site to your account first). Cloudflare issues the certificate. Then set `APP_ORIGIN` to `https://<that-domain>` (e.g. `https://aangan.sanjeevlabs.com`) and redeploy (or just update the secret).

## 5. Supabase

Supabase → Authentication → URL Configuration:

- **Site URL**: `https://<your-domain>` (same as `APP_ORIGIN`).
- **Redirect URLs**: add `https://<your-domain>/auth/callback`, the `https://aangan.<subdomain>.workers.dev/auth/callback` URL if you use it, and the native app's `app.aangan.family://auth/callback`.
- Google provider: enable under Authentication → Providers (its own redirect URI stays Supabase's).

Native builds: `CAP_SERVER_URL=https://<your-domain> npm run cap:sync` (see docs/NATIVE.md).

## 6. Cron

`wrangler.jsonc` declares a Cron Trigger (`0 9 * * *`, UTC), replacing the `crons` entry in `vercel.json`. `cf-worker.mjs` handles it by calling `GET <APP_ORIGIN>/api/ritual-scan` inside the worker with `Authorization: Bearer <CRON_SECRET>`. Test locally with `npx wrangler dev --test-scheduled` and `curl "http://localhost:8787/__scheduled?cron=0+9+*+*+*"`. Cron Triggers run in the dashboard under the worker's Settings → Triggers.

## Things that behave differently on Workers

- **In-memory state is per isolate.** Cloudflare runs many short-lived isolates, so anything kept in module memory is not shared and can reset at any time:
  - the **mock store** (`MOCK=true`): a demo still opens (every isolate seeds the same synthetic families), but writes made in one request may be missing in the next;
  - the **USD 120 spend ledger** and the **model cache** (`lib/llm-server.ts`): the cap is enforced per isolate, not globally, and cached outputs may be recomputed. Keep a provider-side budget/alert on the Meta, Baseten and Modal keys as the hard stop;
  - **rate limits** (OTP and per-session model routes, `lib/auth.ts`) and the partner OAuth hand-off map (`lib/partners/oauth.ts`) are also per isolate.
  Moving these to KV/Durable Objects/Supabase is a later change; nothing was redesigned for this port.
- **No filesystem at runtime.** Ritual configs are bundled through `rituals/index.ts` (a test keeps it in step with `rituals/*.json`).
- **Images are not optimised.** Workers has no built-in Next.js image optimizer; `next.config.mjs` sets `images.unoptimized`, so the few bundled demo photos are served as-is from static assets (edge-cached). To optimise later, add Cloudflare Images (`"images": { "binding": "IMAGES" }` in `wrangler.jsonc`, see opennext.js.org/cloudflare/howtos/image) and remove `unoptimized`.
- **No ISR.** `open-next.config.ts` serves prerendered pages from static assets; Aangan uses no revalidation, so no R2/KV cache bucket is needed. If revalidation is ever added, switch to the R2 incremental cache.
- `node:crypto` (HMAC, SHA-256, AES-256-GCM, `randomBytes`, `randomInt`) and `Buffer` work under `nodejs_compat`.
- Request bodies: Workers accepts request bodies of at least 100 MB, above the app's own 25 MB video limit.
