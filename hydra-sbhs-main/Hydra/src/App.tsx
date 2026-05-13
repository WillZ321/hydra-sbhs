import { useCallback, useEffect, useState } from 'react';
import { beginLogin, completeLogin, isLoggedIn, logout } from './auth';
import { TodayView } from './components/TodayView';
import { WeekView } from './components/WeekView';
import { ErrorBoundary } from './components/ErrorBoundary';

type Tab = 'today' | 'week';

const THEME_KEY = 'hydra.dark';

function SignInGlyph() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ opacity: 0.85 }}>
      <rect x="10" y="10" width="100" height="100" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <rect x="30" y="30" width="60" height="60" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <rect x="50" y="50" width="20" height="20" fill="currentColor" />
      <line x1="0" y1="60" x2="120" y2="60" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.4" />
      <line x1="60" y1="0" x2="60" y2="120" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.4" />
    </svg>
  );
}

export function App() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [authError, setAuthError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState<boolean>(() => {
    const v = localStorage.getItem(THEME_KEY);
    return v == null ? true : v === '1';
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('code')) {
      completeLogin()
        .then(() => setAuthed(true))
        .catch(e => setAuthError(String(e)))
        .finally(() => setReady(true));
    } else {
      setAuthed(isLoggedIn());
      setReady(true);
    }
  }, []);

  // Children call this when an API responds 401 (token revoked or refresh expired).
  const handleUnauthorized = useCallback(() => {
    logout();
    setAuthed(false);
    setAuthError('Your session expired. Please sign in again.');
  }, []);

  const shellClass = `hydra ${dark ? 'dark' : ''}`;

  if (!ready) {
    return (
      <div className={shellClass}>
        <div className="shell">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className={shellClass}>
        <div className="shell">
          <div className="signin">
            <div>
              <div className="si-mark">Hydra</div>
              <div className="si-tag">A quieter timetable</div>
            </div>
            <div className="si-glyph"><SignInGlyph /></div>
            <div className="si-bottom">
              {authError && <div className="si-error">{authError}</div>}
              <button className="si-btn" onClick={beginLogin}>
                <span>Sign in with SBHS</span>
                <span className="mono" style={{ fontSize: 13 }}>→</span>
              </button>
              <div className="si-foot">
                Your data never leaves the browser. Per portal terms, Hydra only talks to{' '}
                <span className="mono">student.sbhs.net.au</span>.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">Hydra</span>
            <span className="brand-sub">SBHS Timetable</span>
          </div>
          <nav className="tabs">
            <button className={`tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>Today</button>
            <button className={`tab ${tab === 'week' ? 'active' : ''}`} onClick={() => setTab('week')}>Cycle</button>
          </nav>
          <div className="topbar-right">
            <button
              className="icon-btn"
              title={dark ? 'Light mode' : 'Dark mode'}
              onClick={() => setDark(d => !d)}
            >
              {dark ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.7 2.7l1.1 1.1M10.2 10.2l1.1 1.1M2.7 11.3l1.1-1.1M10.2 3.8l1.1-1.1"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M12 8.5A5 5 0 0 1 5.5 2a5 5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button
              className="icon-btn"
              title="Sign out"
              onClick={() => { logout(); setAuthed(false); }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11l3-4-3-4M12 7H4M4 2H2v10h2"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>
        <ErrorBoundary>
        <main className="main">
          {tab === 'today'
            ? <TodayView onUnauthorized={handleUnauthorized} />
            : <WeekView onUnauthorized={handleUnauthorized} />}
        </main>
        </ErrorBoundary>
      </div>
    </div>
  );
}
