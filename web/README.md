# HomeChores Web App

Frontend for chore planning, schedule reshuffling, and score trend tracking.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Add Supabase credentials:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run dev server: `npm run dev`

## Current MVP Slice

- Chore day selection and reshuffle trigger
- Add recurring chores
- One-off date capacity overrides
- Schedule preview for next 4 weeks
- Score summary cards for 1/3/6 month periods

## Next Implementation Targets

- Connect chore CRUD to Supabase tables
- Add auth flow with Supabase Auth
- Persist score events and period comparisons
