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
- Completion actions on scheduled tasks (`complete`, `snooze`, `skip`)
- Score summary cards for 1/3/6 month periods (current + delta vs previous)

## Next Implementation Targets

- Weekly review summary page (completed vs planned, score movement, skipped/snoozed counts)
- Notification delivery integration
- Optional edit flows for existing chores (name/minutes/frequency/must-do date)
