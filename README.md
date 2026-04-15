# HomeChores

Web-first household chore planner with smart recurring scheduling, overdue
task prioritization, one-off day limits, and score trend tracking.

## Project Layout

- `web/` - React app (Vite + TypeScript).
- `supabase/migrations/` - SQL migrations for schema + RLS.
- `supabase/complete_project_database_schema.sql` - canonical full schema snapshot used for clean rebuilds.
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

- Keep `supabase/complete_project_database_schema.sql` updated for every schema change.
- Add one migration file per intentional schema change in `supabase/migrations/`.
- Keep migration files clean and remove obsolete pre-release migrations.
- Do not rely on dashboard-only schema edits.
- Update `CHANGELOG.md` in every feature/fix change.

### Required DB change checklist

For every schema update, include both:
1. Incremental migration file (easy to apply in existing environments).
2. Updated canonical full schema file (single-file rebuild source of truth).
