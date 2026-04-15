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
- Supabase auth (email/password)
- Supabase persistence for chores, day limits, and chore-day preferences
- Score summary cards for 1/3/6 month periods (loaded from `score_events`)

## Next Implementation Targets

- Completion actions (`complete`, `skip`, `snooze`) with score event writes
- Trend comparisons versus previous equivalent period
- Notification delivery integration
