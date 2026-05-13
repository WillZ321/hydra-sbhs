import { OAUTH_CONFIG } from './config';

interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const TOKEN_KEY = 'hydra.tokens';
const VERIFIER_KEY = 'hydra.pkce_verifier';
const STATE_KEY = 'hydra.oauth_state';

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function sha256(s: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

export async function beginLogin(): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64url(await sha256(verifier));

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.assign(`${OAUTH_CONFIG.authorizeUrl}?${params}`);
}

export async function completeLogin(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!code) throw new Error('Missing authorization code');
  if (!state || state !== expected) throw new Error('OAuth state mismatch');
  if (!verifier) throw new Error('Missing PKCE verifier');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    client_id: OAUTH_CONFIG.clientId,
    code_verifier: verifier,
  });

  const res = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  saveTokens(data);

  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  // Clean up the URL.
  window.history.replaceState({}, '', import.meta.env.BASE_URL);
}

function saveTokens(raw: { access_token: string; refresh_token: string; expires_in: number }): void {
  const tokens: TokenSet = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: Date.now() + raw.expires_in * 1000 - 30_000, // 30s safety margin
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function loadTokens(): TokenSet | null {
  const s = localStorage.getItem(TOKEN_KEY);
  return s ? JSON.parse(s) : null;
}

export function isLoggedIn(): boolean {
  return loadTokens() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'NotAuthenticatedError';
  }
}

async function refreshTokens(refresh_token: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: OAUTH_CONFIG.clientId,
  });
  const res = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    // Refresh token revoked / expired — wipe state so the app routes to sign-in.
    if (res.status === 400 || res.status === 401) {
      logout();
      throw new NotAuthenticatedError();
    }
    throw new Error(`Refresh failed: ${res.status}`);
  }
  const data = await res.json();
  saveTokens(data);
  return loadTokens()!;
}

export async function getAccessToken(): Promise<string> {
  const t = loadTokens();
  if (!t) throw new NotAuthenticatedError();
  if (Date.now() < t.expires_at) return t.access_token;
  const refreshed = await refreshTokens(t.refresh_token);
  return refreshed.access_token;
}
