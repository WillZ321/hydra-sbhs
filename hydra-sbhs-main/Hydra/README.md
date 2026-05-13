# Hydra — SBHS Timetable

A quieter take on the SBHS Student Portal timetable. React + Vite SPA, PKCE OAuth, offline cache, today view with variations, full cycle (Week A/B) view, and a live bell countdown.

Editorial-minimal design with light/dark themes.

## Architecture

- [src/auth.ts](src/auth.ts) — PKCE Authorization Code flow, tokens in `localStorage`, auto-refresh on expiry.
- [src/api.ts](src/api.ts) — thin wrapper around the three timetable endpoints.
- [src/cache.ts](src/cache.ts) — TTL'd `localStorage` cache with stale-on-error fallback (offline support).
- [src/components/TodayView.tsx](src/components/TodayView.tsx) — hero with current period + live bell countdown, today's changes banner, tap-to-expand period rows.
- [src/components/WeekView.tsx](src/components/WeekView.tsx) — Week A/B grid (`timetable.json`, cached 24h) with subject color stripes.
- [src/App.tsx](src/App.tsx) — sign-in, top nav, dark-mode toggle.

## Security

See [SECURITY.md](SECURITY.md). Short version: no data leaves your browser except to `*.sbhs.net.au`, enforced by CSP.

## Notes

- For accelerants (multiple year groups), the API returns the higher-year period; no extra logic needed client-side.
- Bell timings, room and class variations are surfaced inline; no separate notifications screen.
