// Register your app at https://student.sbhs.net.au/apps to obtain a Client ID,
// then set VITE_SBHS_CLIENT_ID in .env.local (see .env.example).
const CLIENT_ID = import.meta.env.VITE_SBHS_CLIENT_ID ?? '';

if (!CLIENT_ID && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn('[hydra] VITE_SBHS_CLIENT_ID is not set — OAuth will fail. Copy .env.example to .env.local.');
}

// Build the redirect URI from the current origin + Vite base path so the same
// build works for local dev and GitHub Pages. Register BOTH exact URLs on the
// SBHS /apps page (the local one, plus your deployed origin + base + /callback).
function buildRedirectUri(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/';
  return `${window.location.origin}${base}callback`;
}

export const OAUTH_CONFIG = {
  clientId: CLIENT_ID,
  redirectUri: buildRedirectUri(),
  scope: 'all-ro',
  authorizeUrl: 'https://auth.sbhs.net.au/authorize',
  tokenUrl: 'https://auth.sbhs.net.au/token',
  apiBase: 'https://student.sbhs.net.au/api',
};
