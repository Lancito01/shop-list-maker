# Finance Helper

A simple finance helper web app built with **Next.js**, **Google OAuth (NextAuth)**, and **Postgres via Vercel-managed Neon**.

## Features

- Private lists (Google sign-in)
- Add, edit, and remove list items
- Track item amount/quantity and unit price
- Dynamic per-item subtotals and full-list totals
- Responsive, minimal UI

## Tech stack

- Next.js App Router + TypeScript
- NextAuth (Google OAuth)
- Drizzle ORM + Drizzle Kit migrations
- Postgres (Vercel-managed Neon)

## Environment variables

Create a `.env.local` file:

```bash
# Google OAuth (from Google Cloud Console)
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# NextAuth session signing key
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Use one of these
POSTGRES_URL=...      # Vercel-provided connection string
# or
DATABASE_URL=...      # standard postgres URL
```

## Local setup

```bash
npm install
npm run db:migrate
npm run dev
```

Visit `http://localhost:3000`.

## Database workflow

- `npm run db:generate` — generate SQL migration files after schema changes
- `npm run db:migrate` — apply migrations to the configured database
- `npm run db:studio` — inspect data with Drizzle Studio

## Deploying to Vercel

1. Create a Postgres database via Vercel's Neon integration.
2. Add all environment variables in your Vercel project settings.
3. Deploy the app.
4. Run migrations against production (`npm run db:migrate` from a trusted environment configured with production DB credentials).
