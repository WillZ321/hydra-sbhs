import { useEffect, useMemo, useState } from 'react';
import { getBells, getFullTimetable, UnauthorizedError } from '../api';
import { NotAuthenticatedError } from '../auth';
import { cached } from '../cache';
import type { BellsResponse, FullTimetable } from '../types';

const SUBJECT_CODE: Record<string, string> = {
  'English Adv.': 'EN', 'English Advanced': 'EN', 'English': 'EN',
  'Maths Ext. 1': 'MX', 'Mathematics Extension 1': 'MX', 'Maths': 'MX', 'Mathematics': 'MX',
  'Physics': 'PH',
  'Modern Hist.': 'MH', 'Modern History': 'MH', 'History': 'MH',
  'PDHPE': 'PE',
  'Software Eng.': 'ST', 'Software Engineering': 'ST', 'Software': 'ST',
  'Music 1': 'MU', 'Music': 'MU',
  'Free': '', 'Roll Call': '',
};

const LEGEND: Array<[string, string, string]> = [
  ['EN', 'English', 'oklch(0.65 0.12 60)'],
  ['MX', 'Maths', 'oklch(0.65 0.12 200)'],
  ['PH', 'Physics', 'oklch(0.65 0.12 280)'],
  ['MH', 'History', 'oklch(0.65 0.12 30)'],
  ['PE', 'PDHPE', 'oklch(0.65 0.12 140)'],
  ['ST', 'Software', 'oklch(0.65 0.12 240)'],
  ['MU', 'Music', 'oklch(0.65 0.12 320)'],
];

const BELL_TIMES = ['09:15', '10:20', '11:40', '13:25', '14:25'];
const PERIOD_IDS = ['1', '2', '3', '4', '5'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function codeFor(title?: string): string {
  if (!title) return '';
  return SUBJECT_CODE[title] || '';
}

function stripTitle(t: string): string {
  return t.replace(/^(Mr|Ms|Mrs|Dr|Mx) /, '');
}

export function WeekView({ onUnauthorized }: { onUnauthorized?: () => void } = {}) {
  const [tt, setTt] = useState<FullTimetable | null>(null);
  const [bells, setBells] = useState<BellsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<'A' | 'B'>('A');

  useEffect(() => {
    const handleAuthErr = (e: unknown) => {
      if (e instanceof UnauthorizedError || e instanceof NotAuthenticatedError) {
        onUnauthorized?.();
        return true;
      }
      return false;
    };
    cached('full', 24 * 60 * 60 * 1000, getFullTimetable)
      .then(setTt)
      .catch(e => { if (!handleAuthErr(e)) setError(String(e)); });
    cached(`bells.${todayISO()}`, 60 * 60 * 1000, () => getBells(todayISO()))
      .then(b => {
        setBells(b);
        if (b.weekType === 'A' || b.weekType === 'B') setWeek(b.weekType);
      })
      .catch(e => { handleAuthErr(e); /* otherwise ignore — week toggle still works */ });
  }, [onUnauthorized]);

  // Filter out days with no periods (non-teaching / routine-only / accelerant-gap days)
  // so we never render a column that would throw when accessing d.periods[pid].
  const allDayKeys = useMemo(
    () => tt
      ? Object.keys(tt.days)
          .filter(k => tt.days[k]?.periods)
          .sort((a, b) => Number(a) - Number(b))
      : [],
    [tt],
  );
  const half = Math.ceil(allDayKeys.length / 2);
  const weekDays = week === 'A' ? allDayKeys.slice(0, half) : allDayKeys.slice(half);

  if (error) return <div className="error-state">{error}</div>;
  if (!tt) return <div className="loading">Loading…</div>;

  const todayKey = bells?.dayNumber;
  const todayWeek = bells?.weekType;

  return (
    <div className="container">
      <div className="week-head">
        <div>
          <div className="eyebrow">
            <span>
              {tt.student?.firstName} {tt.student?.surname}
              {tt.student?.yearGroup ? ` · Year ${tt.student.yearGroup}` : ''}
              {tt.student?.rollClass ? ` · ${tt.student.rollClass}` : ''}
            </span>
          </div>
          <h2>Cycle</h2>
        </div>
        <div className="week-toggle">
          <button className={week === 'A' ? 'active' : ''} onClick={() => setWeek('A')}>Week A</button>
          <button className={week === 'B' ? 'active' : ''} onClick={() => setWeek('B')}>Week B</button>
        </div>
      </div>

      <div
        className="week-grid"
        style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))` }}
      >
        <div className="wg-head" />
        {weekDays.map((dk, i) => {
          const d = tt.days[dk];
          const isToday = week === todayWeek && dk === todayKey;
          const isLast = i === weekDays.length - 1;
          return (
            <div key={dk} className={`wg-head ${isLast ? 'last-col' : ''}`}>
              {d.dayname}
              {isToday && <span style={{ marginLeft: 6, color: 'var(--accent)' }}>·</span>}
            </div>
          );
        })}

        {PERIOD_IDS.map((pid, rowIdx) => (
          <div key={`row-${pid}`} style={{ display: 'contents' }}>
            <div className={`wg-time ${rowIdx === 0 ? 'first' : ''}`}>{BELL_TIMES[rowIdx]}</div>
            {weekDays.map((dk, i) => {
              const d = tt.days[dk];
              // Belt-and-suspenders guard: allDayKeys already filters days without periods,
              // but optional chaining here prevents a throw if an edge case slips through.
              const p = d?.periods?.[pid];
              const isFree = !p || p.title === 'Free';
              const code = codeFor(p?.title);
              const isToday = week === todayWeek && dk === todayKey;
              const isLast = i === weekDays.length - 1;
              const cls = [
                'wg-cell',
                isFree && 'free',
                isToday && 'today',
                code && `subject-${code}`,
                isLast && 'last-col',
              ].filter(Boolean).join(' ');
              return (
                <div key={dk + pid} className={cls}>
                  <div className="wg-title">{p?.title || '–'}</div>
                  {p && !isFree && (
                    <div className="wg-meta">{p.room} · {stripTitle(p.teacher)}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="week-legend">
        {LEGEND.map(([code, label, color]) => (
          <span key={code} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span className="swatch" style={{ background: color }} />
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
