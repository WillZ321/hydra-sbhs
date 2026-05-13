import { OAUTH_CONFIG } from './config';
import { getAccessToken, logout } from './auth';
import type { BellsResponse, DayTimetable, FullTimetable } from './types';

/**
 * Thrown when the API returns 401 after a refresh attempt — the caller should
 * route the user back to sign-in. We also clear local tokens before throwing.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function isTransientStatus(status: number): boolean {
  // 408 Request Timeout, 429 Too Many Requests, 5xx server errors
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || !isTransientStatus(res.status) || attempt === MAX_RETRIES) {
        return res;
      }
      // transient → fall through to backoff
      lastError = new Error(`${res.status}`);
    } catch (err) {
      // network failure
      lastError = err;
      if (attempt === MAX_RETRIES) throw err;
    }
    // Exponential backoff with jitter
    const delay = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 200;
    await sleep(delay);
  }
  throw lastError;
}

async function apiGet<T>(path: string, params?: Record<string, string>, auth = true): Promise<T> {
  const url = new URL(`${OAUTH_CONFIG.apiBase}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = {};
  if (auth) headers['Authorization'] = `Bearer ${await getAccessToken()}`;

  const res = await fetchWithRetry(url.toString(), { headers });

  if (res.status === 401 && auth) {
    // Token rejected even after the just-completed refresh check.
    // Per portal spec: discard tokens and restart the OAuth flow.
    logout();
    throw new UnauthorizedError();
  }

  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function getBells(date?: string): Promise<BellsResponse> {
  return apiGet('/timetable/bells.json', date ? { date } : undefined, false);
}

export function getDayTimetable(date?: string): Promise<DayTimetable> {
  return apiGet('/timetable/daytimetable.json', date ? { date } : undefined);
}

export function getFullTimetable(): Promise<FullTimetable> {
  return apiGet('/timetable/timetable.json');
}
