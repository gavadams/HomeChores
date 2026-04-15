# HomeChores

Web-first household chore planner with smart recurring scheduling, overdue
task prioritization, one-off day limits, and score trend tracking.

## Project Layout

- `web/` - React app (Vite + TypeScript).
- `supabase/migrations/` - SQL migrations for schema + RLS.
- `CHANGELOG.md` - Required change history from project start.

## Local Development

1. Install dependencies:
   - `cd web`
   - `npm install`
2. Configure environment:
   - copy `web/.env.example` to `web/.env`
   - set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Run the app:
   - `npm run dev`

## Supabase Schema Workflow

- Add one migration per intentional schema change.
- Keep migration files clean and remove obsolete pre-release migrations.
- Do not rely on dashboard-only schema edits.
- Update `CHANGELOG.md` in every feature/fix change.
