# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project overview

A lead generation and outreach CRM built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Supabase**. It scrapes local businesses, enriches them with decision-maker and contact data, and tracks them through a sales pipeline.

## Commands

```bash
npm run dev     # local dev server on http://localhost:3000
npm run build   # production build — run this before pushing; deploys fail on type errors
npm run lint    # ESLint
```

Environment variables are documented in `.env.example`. Never commit `.env*` files.

## Architecture

```
app/api/**/route.ts   Route handlers: all server-side work (scraping, DB, LLM calls)
app/**/page.tsx       Client pages ("use client") that call the API routes via fetch
components/           Shared UI (Sidebar, tables, charts, pipeline panel)
lib/                  Business logic, one module per source/concern
```

Keep route handlers thin: parse the request, call into `lib/`, return JSON.

### Key modules in `lib/`

| Module | Responsibility |
| --- | --- |
| `supabase.ts` | Shared Supabase client — import this, don't create new clients |
| `googleplaces.ts` | Google Places API lead search (preferred when `GOOGLE_PLACES_API_KEY` is set) |
| `googlemaps.ts` | Puppeteer fallback scraper for Google Maps |
| `companieshouse.ts` | Director lookup and niche verification via the public Companies House site |
| `enrich.ts` | Crawls websites to extract emails and social links |
| `llm.ts` | Outreach message generation (OpenAI `gpt-4o-mini` or Gemini `2.5-flash`) |
| `outreach.ts` | Puppeteer browser session, plus pipeline/outreach state helpers |
| `youtube.ts`, `skool.ts`, `whop.ts`, `instagram.ts` | Other lead sources |
| `csv.ts` | `NormalizedLead` type, per-source normalisers, CSV export |
| `db.ts` | Deduplicate leads against Supabase and persist new ones |

### Data

- **Supabase tables:** `leads`, `crm_users`, `email_templates`.
- **Deduplication:** leads are unique by `link`. Always check existing links before scraping or inserting, and upsert with `onConflict: "link"`.
- **Per-user scoping:** leads record `scraped_by`. The logged-in user is stored client-side under the `crm_user` localStorage key and passed to the API as `scrapedBy`. Filter lists so users only see their own leads (or unowned ones).
- **Pipeline state** (`pipeline_status`, email and reminder status, booked call time) is kept in a local `outreach_status.json` log via the helpers in `lib/outreach.ts` and merged onto Supabase leads when read. The file is gitignored — never commit it.
- Valid pipeline statuses: `none`, `text_followup`, `email_followup`, `booked_call`, `Closed / Won`.

### Patterns

- **Long-running scrapes stream progress** with Server-Sent Events: the route returns a `ReadableStream` of `data: {status, message}` lines, and the page reads it with `response.body.getReader()`. Follow this pattern for any new long-running job.
- **Graceful degradation:** features with optional API keys must fall back rather than fail (e.g. Places API → Puppeteer, no OpenAI key → skip location expansion).
- **Automation hooks:** `app/api/pipeline/route.ts` fires the `N8N_WEBHOOK_URL` webhook on pipeline events. Downstream emails and reminders live in n8n, not in this codebase.

## Deployment

Deployed on **Railway** using Nixpacks. `nixpacks.toml` installs Chromium and its system libraries so Puppeteer can run headless in production (`headless` is enabled when `NODE_ENV === "production"`). If you add a Puppeteer feature, make sure it works headless.

## Conventions

- TypeScript throughout; use the `@/` path alias for imports.
- Styling uses `app/globals.css` plus inline styles; there is no CSS framework.
- Don't commit debug artefacts (`public/debug-*.png`, scratch scripts).
- Build must pass with no type errors: Railway builds run `next build`.

## Known limitations / roadmap

- Auth is a simple custom email/password check against `crm_users`. Planned: migrate to Supabase Auth with row-level security and enforce auth on API routes server-side.
- Pipeline state lives in a local JSON file; planned: move it into Supabase columns so it persists across deploys.
