# Bracketline

A sleek tournament-bracket platform. Build single-elimination brackets for
**3 to 128** participants with custom seed labels (numbers or codes like
`E4`, `R3-2`), custom names, and live score reporting — with light/dark
themes, a light-blue accent, and a layout that works on desktop and phone.

## Features

- **Any bracket size from 3 to 128** — byes are placed automatically using
  standard seeding, so top entries get the byes and every bracket plays out
  fairly. Empty sections of the draw resolve as walkovers.
- **Custom seeds** — every participant has a free-text seed label.
- **Placement modes** — seeded (1 vs lowest), in listed order, or random draw.
- **Scores & winners** — click any match to enter scores or tap a player to
  mark the winner; changing an earlier result clears the affected path.
- **Accounts** — email/password accounts with cookie sessions; brackets are
  saved to the server and shareable by link. Guests can build brackets that
  live in their browser and move them into an account later.
- **Light & dark mode** with a light-blue accent, responsive on mobile.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- SQLite via `better-sqlite3` (database file created at `data/bracketline.db`)
- No CSS framework — hand-rolled design system in `app/globals.css`
  driven by CSS custom properties for theming

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

## Layout

| Path | Purpose |
| --- | --- |
| `lib/bracket.ts` | Bracket model: seeding order, bye placement, match computation, result propagation |
| `lib/db.ts`, `lib/auth.ts` | SQLite schema, scrypt password hashing, cookie sessions |
| `lib/localBrackets.ts` | Browser-side storage for guest brackets |
| `components/BracketView.tsx` | Bracket renderer (positioned cards + SVG connectors) and match editor |
| `app/new` | Bracket builder |
| `app/b/[id]` | Bracket viewer/editor (`local-*` ids live in the browser) |
| `app/dashboard` | List of cloud + local brackets |
| `app/api/*` | Auth and bracket CRUD endpoints |

## Roadmap ideas

- Paid plans (more saved brackets, custom branding)
- Double elimination and round robin
- Real-time spectating
