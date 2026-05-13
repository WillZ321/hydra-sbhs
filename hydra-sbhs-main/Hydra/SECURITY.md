# Security notes

## Threat model

Hydra is a static SPA that talks only to two origins:

- `https://auth.sbhs.net.au` — OAuth authorize + token endpoints
- `https://student.sbhs.net.au` — timetable APIs

No backend, no analytics, no third-party telemetry. All user data stays in the browser.

## Auth

- **OAuth 2.0 Authorization Code + PKCE (S256).** No client secret (it's a public client).
- `state` is generated per-login and verified on callback to prevent CSRF.
- The `code_verifier` lives in `sessionStorage` only between redirect-out and redirect-back, then is deleted.

## Token storage — known tradeoff

Access and refresh tokens are stored in `localStorage` (key `hydra.tokens`). This is the standard tradeoff for client-only SPAs:

- **Pro:** survives page reloads, enables auto-refresh, works offline.
- **Con:** any script running on the page can read them. An XSS would mean token theft.

Mitigations in place:
- A strict Content-Security-Policy is set in [index.html](index.html) — `script-src 'self'` blocks inline scripts and third-party JS, which is the primary XSS vector.
- React's default JSX escaping is used throughout; no `dangerouslySetInnerHTML`.
- The only third-party assets are Google Fonts (CSS + font files), constrained by CSP.
- Tokens have a short access-token lifetime; refresh tokens can be revoked from the SBHS portal.

If you need stronger guarantees, deploy a backend that holds the refresh token in an HttpOnly cookie. Out of scope for this build.

## CSP

See the `Content-Security-Policy` meta tag in [index.html](index.html). Tightening notes:

- `style-src` includes `'unsafe-inline'` because Vite + JSX inject inline styles. Acceptable — CSS injection is not the XSS vector we care about here.
- `connect-src` is locked to `'self'` plus the two SBHS origins. Any exfiltration attempt to a third-party host will be blocked.

## Secrets in CI

The GitHub Actions workflow expects a repo secret named `VITE_SBHS_CLIENT_ID`. The Client ID is **not** a secret in the cryptographic sense (it's embedded in the deployed JS bundle), but keeping it out of source means you can rotate it without a commit and avoid leaking it for forks.

## Conformance with the SBHS portal API requirements

| Requirement | Implementation |
|---|---|
| 1. OAuth 2 library | Hand-rolled PKCE flow in [src/auth.ts](src/auth.ts) — RFC 7636 S256, OAuth state validation, no client secret. |
| 2. Redirect URI | Built from `window.location.origin + import.meta.env.BASE_URL + 'callback'`. Same code works for local dev and GitHub Pages — register both URLs on the portal. |
| 3. App ID + PKCE | Public client (no secret). `code_challenge_method=S256`. `VITE_SBHS_CLIENT_ID` env var. |
| 4. Token storage | Access + refresh tokens in `localStorage` (key `hydra.tokens`). 30s safety margin on expiry. See tradeoff above. |
| 5. Fault tolerance | [src/api.ts](src/api.ts): exponential backoff retry (2 retries, jitter) for transient failures (408, 429, 5xx, network errors). On 401, tokens are discarded via `logout()` and `UnauthorizedError` propagates up so the app returns to sign-in. Refresh-token failures (400/401) likewise clear state and throw `NotAuthenticatedError`. |
| 6. Scopes | `all-ro` only. OIDC scopes are not requested — student identity comes from the timetable API itself. |

## Reporting

Open a private security advisory on the repo or email the maintainer. Please don't file public issues for vulnerabilities.
