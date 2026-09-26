# Bracketline

A sleek tournament-bracket platform. Build single-elimination brackets for
**3 to 128** participants with custom seed labels (numbers or codes like
`E4`, `R3-2`), custom names, and live score reporting — with light/dark
themes, a light-blue accent, and a layout that works on desktop and phone.

## Features

- **Sports and scoring** — pick a sport when you create a tournament.
  Football, basketball and soccer use a single score per match; volleyball,
  tennis and baseball are scored set by set (or game by game) as a best of
  1/3/5/7. The bracket shows the series score (2–1) and the individual set
  scores live behind the match.
- **Group play into one or more brackets** — round-robin groups with live
  standings (matches won/lost, sets won/lost, points for/against), then send
  each finishing place wherever you want: places 1–2 into Gold, 3–4 into
  Silver, and so on.
- **Any bracket size from 3 to 128** — byes are placed automatically using
  standard seeding, so top entries get the byes and every bracket plays out
  fairly. Empty sections of the draw resolve as walkovers.
- **Custom seeds** — every participant has a free-text seed label.
- **Placement modes** — seeded (1 vs lowest), in listed order, or random draw.
- **Scores & winners** — click any match to enter scores or tap a player to
  mark the winner; changing an earlier result clears the affected path.
- **Accounts** — email/password accounts with cookie sessions and
  self-serve password reset; brackets are saved to the server and shareable
  by link. Guests can build brackets that live in their browser and move
  them into an account later.
- **Light & dark mode** with a light-blue accent, responsive on mobile.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- SQLite-compatible storage via [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts):
  a local file (`data/bracketline.db`) in development, [Turso](https://turso.tech)
  in production
- No CSS framework — hand-rolled design system in `app/globals.css`
  driven by CSS custom properties for theming

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

No configuration needed — without env vars the app uses a local SQLite file.

Production build:

```bash
npm run build
npm start
```

## Deploying to Vercel

Vercel's serverless filesystem is ephemeral, so the database lives in
[Turso](https://turso.tech) (SQLite-compatible, free tier available):

1. Create a Turso database and grab its credentials:
   ```bash
   turso db create bracketline
   turso db show bracketline --url     # -> TURSO_DATABASE_URL
   turso db tokens create bracketline  # -> TURSO_AUTH_TOKEN
   ```
   (Or create the database and token in the Turso web dashboard.)
2. Import this repository into Vercel (Add New → Project). The Next.js
   defaults are correct as-is.
3. In the project's **Settings → Environment Variables**, add
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
4. Deploy. Tables are created automatically on first use.

### Custom links

Brackets are normally at `/b/<id>`. An admin can also give one a custom link
at the root of the site — `yourdomain.com/blalock2026` — from the bracket's
Customize panel. Set `ADMIN_EMAILS` to a comma-separated list of the accounts
allowed to do this:

```
ADMIN_EMAILS=you@example.com
```

Links are lowercase letters, numbers and hyphens, must be unique, and can't
take one of the app's own paths (`new`, `login`, `dashboard`, …). The original
`/b/<id>` link keeps working alongside the custom one.

### Password-reset emails

Reset links are generated whether or not email is configured — without a key
they're written to the server logs (visible in Vercel's Runtime Logs) so the
flow still works. To send real emails, add a `RESEND_API_KEY` from
[Resend](https://resend.com) and, once you've verified a domain, an
`EMAIL_FROM` address.

## Layout

| Path | Purpose |
| --- | --- |
| `lib/bracket.ts` | Tournament model: sports/scoring, seeding order, bye placement, single & double elimination, group standings, multi-bracket qualification |
| `lib/db.ts`, `lib/auth.ts` | SQLite schema, scrypt password hashing, cookie sessions |
| `lib/localBrackets.ts` | Browser-side storage for guest brackets |
| `lib/slug.ts` | Custom-link validation and reserved paths |
| `components/BracketPage.tsx` | The bracket screen, shared by `/b/[id]` and custom links |
| `components/BracketView.tsx` | Bracket renderer (positioned cards + SVG connectors) and the match editor (single score or set-by-set) |
| `components/GroupStageView.tsx` | Group standings tables, round-robin fixtures, manual finishing order |
| `app/new` | Bracket builder |
| `app/b/[id]` | Bracket viewer/editor (`local-*` ids live in the browser) |
| `app/[slug]` | Custom links, resolved server-side to a bracket |
| `app/dashboard` | List of cloud + local brackets |
| `app/api/*` | Auth and bracket CRUD endpoints |

## Roadmap ideas

- Paid plans (more saved brackets, custom branding)
- Real-time spectating
