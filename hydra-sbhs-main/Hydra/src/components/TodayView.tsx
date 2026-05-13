import { useEffect, useMemo, useState } from 'react';
import { getBells, getDayTimetable, UnauthorizedError } from '../api';
import { NotAuthenticatedError } from '../auth';
import { cached } from '../cache';
import type { Bell, BellsResponse, DayTimetable, ClassVariation, RoomVariation } from '../types';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function asArray<T>(v: Record<string, T> | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : Object.values(v);
}

function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function fmtCountdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface Segment extends Bell { t: number; start: number; end: number; }

function buildSegments(bells: Bell[]): Segment[] {
  const times = bells.map(b => ({ ...b, t: parseHM(b.time) }));
  const segs: Segment[] = [];
  for (let i = 0; i < times.length; i++) {
    const b = times[i];
    const next = times[i + 1];
    segs.push({ ...b, start: b.t, end: next ? next.t : b.t + 60 * 60 * 1000 });
  }
  return segs;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} · ${d.getFullYear()}`;
}

export function TodayView({ onUnauthorized }: { onUnauthorized?: () => void } = {}) {
  const [date, setDate] = useState(todayISO());
  const [bells, setBells] = useState<BellsResponse | null>(null);
  const [day, setDay] = useState<DayTimetable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    Promise.all([
      cached(`bells.${date}`, 60 * 60 * 1000, () => getBells(date)),
      cached(`day.${date}`, 10 * 60 * 1000, () => getDayTimetable(date)),
    ])
      .then(([b, d]) => {
        if (cancel) return;
        setBells(b);
        setDay(d);
      })
      .catch(e => {
        if (cancel) return;
        if (e instanceof UnauthorizedError || e instanceof NotAuthenticatedError) {
          onUnauthorized?.();
          return;
        }
        setError(String(e));
      })
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [date, onUnauthorized]);

  const segments = useMemo(() => bells ? buildSegments(bells.bells) : [], [bells]);
  const current = segments.find(s => now >= s.start && now < s.end);
  const nextBell = bells?.bells.map(b => ({ b, t: parseHM(b.time) })).find(x => x.t > now);

  if (loading && !day) return <div className="loading">Loading…</div>;
  if (error) return <div className="error-state">{error}</div>;
  if (!bells || !day) return null;

  const periods = day.timetable.timetable.periods;
  const routine = day.timetable.timetable.routine.split(',');
  const roomVars = asArray<RoomVariation>(day.roomVariations);
  const classVars = asArray<ClassVariation>(day.classVariations);
  const showVar = day.shouldDisplayVariations;
  const varCount = showVar
    ? roomVars.length + classVars.filter(c => c.type !== 'novariation').length
    : 0;

  const variationSummary = (() => {
    const parts: string[] = [];
    roomVars.forEach(rv => {
      const p = periods[rv.period];
      parts.push(`Room change for ${p?.title ?? `P${rv.period}`}`);
    });
    classVars.filter(c => c.type !== 'novariation').forEach(cv => {
      const p = periods[cv.period];
      const title = p?.title ?? `P${cv.period}`;
      if (cv.type === 'nocover') parts.push(`No substitute for ${title}`);
      else if (cv.type === 'replacement') parts.push(`Substitute for ${title}`);
    });
    return parts.join(' · ');
  })();

  const currentPeriod = current && periods[current.bell] ? periods[current.bell] : null;
  const currentBellDisp = current?.bellDisplay || current?.bell;

  return (
    <div className="container">
      <div className="hero">
        <div>
          <div className="eyebrow">
            <span className="dot" />
            <span>
              Now · {day.timetable.timetable.dayname} · Week {bells.week} · {bells.weekType}
            </span>
          </div>
          <h1 className="now-title">
            {currentPeriod ? currentPeriod.title : currentBellDisp || 'Before school'}
          </h1>
          <div className="now-meta">
            {currentPeriod && <span className="mono">{currentPeriod.room}</span>}
            {currentPeriod && <span className="sep">·</span>}
            {currentPeriod && <span>{currentPeriod.fullTeacher || currentPeriod.teacher}</span>}
            {!currentPeriod && <span>Term {bells.term}</span>}
          </div>
        </div>

        <div className="countdown-block">
          <div className="countdown-label">Next bell in</div>
          <div className="countdown-time">
            {nextBell ? fmtCountdown(nextBell.t - now) : '—'}
          </div>
          <div className="countdown-next">
            {nextBell ? (
              <>{nextBell.b.bellDisplay || nextBell.b.bell} · <span className="mono">{nextBell.b.time}</span></>
            ) : 'No more bells today'}
          </div>
        </div>
      </div>

      {bells.bellsAltered && (
        <div className="banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="b-lbl">Bells altered</span>
            <span>{bells.bellsAlteredReason}</span>
          </div>
        </div>
      )}

      {varCount > 0 && (
        <div className="banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="b-lbl">Today's changes</span>
            <span>{variationSummary}</span>
          </div>
          <span className="b-count">{varCount}</span>
        </div>
      )}

      <div className="day-meta">
        <h3>The day</h3>
        <input
          type="date"
          className="date-pick mono"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      <ol className="day-list">
        {routine.map((id, idx) => {
          const p = periods[id];
          const bell = bells.bells.find(b => b.bell === id || b.period === id);
          const seg = segments.find(s => s.bell === id);
          const isPast = seg ? now > seg.end : false;
          const isNow = current?.bell === id;
          const rv = showVar ? roomVars.find(r => r.period === id) : undefined;
          const cv = showVar ? classVars.find(c => c.period === id && c.type !== 'novariation') : undefined;
          const isFree = !p;
          const isExpanded = expanded === id;

          const label = id === 'Rollcall' ? 'Roll' : /^\d+$/.test(id) ? `P${id}` : id;
          const nextSegTime = (() => {
            const ix = bells.bells.findIndex(b => b.bell === id);
            const nx = bells.bells[ix + 1];
            return nx ? ' — ' + nx.time : '';
          })();

          return (
            <li
              key={`${id}-${idx}`}
              className={['period', isNow && 'now', isPast && 'past', isFree && 'free'].filter(Boolean).join(' ')}
              onClick={() => !isFree && setExpanded(isExpanded ? null : id)}
            >
              <div className="p-time">
                <span className="p-label">{label}</span>
                <span>{bell?.time || ''}</span>
              </div>

              <div>
                <div className="p-title">
                  {p ? p.title : (bell?.bellDisplay || id)}
                </div>
                {(rv || cv) && (
                  <div className="p-sub">
                    {rv && (
                      <span>
                        <span className="strike">{rv.roomFrom ?? p?.room}</span> → <span className="hi">{rv.roomTo}</span>
                      </span>
                    )}
                    {cv?.type === 'nocover' && <span className="hi">No substitute</span>}
                    {cv?.type === 'replacement' && <span className="hi">Substitute: {cv.casual ?? cv.casualSurname}</span>}
                  </div>
                )}
              </div>

              <div className="p-right">
                {p && (
                  <>
                    <span className="room">{rv ? rv.roomTo : p.room}</span>
                    <span>{cv?.type === 'replacement' ? (cv.casual ?? cv.casualSurname) : (p.teacher || '')}</span>
                  </>
                )}
              </div>

              {isExpanded && p && (
                <div className="p-expand">
                  <div>
                    <div className="k">Teacher</div>
                    <div className="v">
                      {cv?.type === 'replacement'
                        ? <><span className="hi">{cv.casual ?? cv.casualSurname}</span> <span style={{ color: 'var(--muted)' }}>(rel.)</span></>
                        : (p.fullTeacher || p.teacher)}
                    </div>
                  </div>
                  <div>
                    <div className="k">Room</div>
                    <div className="v mono">
                      {rv ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{rv.roomFrom ?? p.room}</span>{' '}
                          <span className="hi">{rv.roomTo}</span>
                        </>
                      ) : p.room}
                    </div>
                  </div>
                  <div>
                    <div className="k">Time</div>
                    <div className="v mono">{bell?.time}{nextSegTime}</div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div style={{ marginTop: 36, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em' }}>
        {formatDate(date)} · Term {bells.term}
      </div>
    </div>
  );
}
