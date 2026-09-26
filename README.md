# Lead Gen CRM

A full-stack lead generation and outreach CRM I built and use day-to-day for my agency, GMT Solutions. It finds local businesses, identifies their decision-makers, and manages them through a sales pipeline, from first contact to booked call.

<img width="1916" height="980" alt="image" src="https://github.com/user-attachments/assets/e4c14365-be6a-4ddb-84ae-22325e242b9b" />


## What it does

**Lead scraping**
- **Google Maps / Places**: searches for businesses by niche and location, using the Google Places API when a key is available and falling back to a headless-browser scraper otherwise.
- **Smart location expansion**: when one area runs dry, an LLM suggests nearby towns and boroughs and the scraper works through them as a queue until the target lead count is hit.
- **Companies House enrichment**: looks up each UK business on Companies House to find its active directors and verify it matches the target niche.
- **Other sources**: YouTube channel analysis (Data API), Skool and Whop marketplace scraping, and Instagram lead discovery.
- **Contact enrichment**: crawls lead websites to pull emails and social links.
- **Deduplication**: every lead is checked against the database so nothing is scraped or contacted twice.

**CRM & pipeline**
- Multi-user login with leads scoped to the user who scraped them.
- Kanban-style pipeline (`text follow-up → email follow-up → booked call`), plus tasks, clients, and a recycle bin.
- Reusable email templates, scheduled sends, and booked-call reminders.
- Pipeline events trigger an **n8n** webhook for downstream automation (emails, reminders).
- AI-personalised outreach messages (OpenAI `gpt-4o-mini` or Gemini `2.5-flash`).
- Live scrape progress streamed to the UI via Server-Sent Events.
- CSV export.

## Tech stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16 (App Router, Route Handlers), React 19, TypeScript |
| Database | Supabase (Postgres) |
| Scraping | Puppeteer (+ stealth plugin), Cheerio, Google Places API, YouTube Data API |
| AI | OpenAI, Google Gemini |
| Automation | n8n webhooks |
| Charts | Recharts |
| Deployment | Railway (Nixpacks, with Chromium for headless scraping) |

## Project structure

```
app/
  api/            Route handlers: scraping, enrichment, auth, pipeline, outreach
  gmt/            CRM: dashboard, scraper, tasks, clients, bin
  pipeline/       Sales pipeline and email templates
  youtube/ skool/ whop/ instagram/ outreach/   Lead-source tools
components/       Sidebar, tables, charts, pipeline panel
lib/              Scrapers, enrichment, LLM, Supabase client, CSV helpers
```

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000.

You'll need a Supabase project with `leads`, `crm_users`, and `email_templates` tables. See `.env.example` for which keys are required and which are optional.

## Notes

This started as a personal tool built for speed, so some parts are pragmatic rather than production-hardened. Next on the list is moving auth to Supabase Auth with row-level security.
