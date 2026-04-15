# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses semantic versioning.

## [Unreleased]

### Added
- Web app scaffold with React + TypeScript + Vite.
- Initial chore planning UI for:
  - recurring chore entry
  - chore-day selection
  - one-off day capacity overrides
  - 1/3/6 month score preview blocks
- Scheduler engine with:
  - overdue-first prioritization
  - oldest-due-date ordering
  - one-off capacity-aware placement
- Supabase initial SQL migration with core tables and RLS policies.
- Project-level changelog and migration-first discipline baseline.
- Supabase auth flow in web app (sign in, sign up, sign out).
- Supabase data layer for chores, one-off day overrides, and user chore-day preferences.
- Automatic persistence of regenerated schedules into `scheduled_chores`.
- Score window loading from `score_events` for 1/3/6 month views.
- Canonical full schema file at `supabase/complete_project_database_schema.sql` for single-file fresh DB rebuilds.

### Changed
- Web app now runs in authenticated cloud mode when Supabase env vars are present.
- Schedule reshuffle now syncs to database when chores/days/overrides change.
- DB workflow now requires both incremental migration files and updates to the canonical full schema file.

### Fixed
- Regenerating the schedule no longer deletes and recreates rows that were already completed, skipped, or snoozed (those statuses now persist across reshuffles and reloads).
- Recurring chores now emit every due occurrence within the planning window, so short intervals like daily tasks appear on each eligible chore day.
- Task status can be updated again after the first action; changing or resetting status removes stale score rows for that scheduled chore before applying the new outcome.
