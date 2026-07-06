# Brownstones Coffee — Team App

An installable (PWA) internal app for Brownstones Coffee: employee management,
AI-optimized scheduling, resources/onboarding, a team social feed, and siloed
chat — all behind a role-based permission model (Super Admin / Manager /
Employee).

Built with **Next.js** (App Router) + **Supabase** (Postgres, Auth, RLS,
Realtime, Storage), deployed on **Netlify**.

## Status — Milestone 1: Foundation + Scheduling

**Done**
- Role-based permission model (Super Admin / Manager / Employee) enforced in
  the database via Row-Level Security — managers only ever see their location(s)
  and staff; employees only see themselves + teammates at their location.
- Auth (email/password + magic link), session middleware, route guards.
- Data model for locations, profiles, positions, shifts, availability,
  time-off, shift swaps, notifications, and web-push subscriptions.
- Installable PWA (manifest + service worker with push handling).
- App shell + Dashboard, Schedule (read), Team, Profile, Admin screens.

**Next**
- Interactive schedule builder + AI optimization (coverage targets → draft
  schedule from availability/time-off/demand).
- Publish → push notifications to scheduled staff.
- Employee availability & time-off request UI.
- Manager staff invites + role assignment.
- Resources/onboarding, quizzes, handbook sign-offs; social feed; chat.

## Architecture: the permission model

Everything hangs off `profiles.role` (`super_admin | manager | employee`) and
`staff_locations` (which locations a person works at / manages). RLS policies
use `SECURITY DEFINER` helper functions (`is_super_admin()`,
`manages_location()`, `shares_location()`, …) so the rules are enforced no
matter which client hits the API. See `supabase/migrations/`.

## Local setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project & apply the schema

Either via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*
psql "$DATABASE_URL" -f supabase/seed.sql   # optional starter data
```

…or paste each file in `supabase/migrations/` (in order) into the Supabase
SQL editor, then `supabase/seed.sql`.

### 3. Configure environment

```bash
cp .env.local.example .env.local
# fill in Supabase URL + keys, and VAPID keys for push
```

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

### 4. Run

```bash
npm run dev        # http://localhost:3000
```

### 5. Create the first Super Admin

1. Sign up / sign in once so a `profiles` row is created.
2. In Supabase SQL editor, promote yourself:
   ```sql
   update public.profiles set role = 'super_admin' where email = 'you@brownstones.com';
   ```

## Deploy (Netlify)

- Connect the repo to Netlify (the `@netlify/plugin-nextjs` plugin is
  configured in `netlify.toml`).
- Add the same env vars in Netlify → Site settings → Environment variables.
- Update `site_url` / redirect URLs in Supabase Auth settings to the Netlify
  domain so magic links resolve.

## Project layout

```
src/
  app/
    (app)/            authenticated shell (dashboard, schedule, team, profile, admin)
    login/            sign-in
    auth/             magic-link callback + sign-out
  components/         header, bottom nav, PWA registration
  lib/
    supabase/         browser / server / middleware clients
    auth.ts           requireProfile / requireRole guards
    database.types.ts typed schema
supabase/
  migrations/         schema + RLS (source of truth)
  seed.sql            starter positions + locations
public/
  manifest.json, sw.js, icons/
```
