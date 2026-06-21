import { useState, useMemo, useEffect, useCallback } from 'react';
import { mealApi } from '../../../entities/meal/api/mealApi';
import { analyticsApi } from '../../../entities/nutrition/api/analyticsApi';
import { useProfileStore } from '../../../entities/user/model/profile';
import styles from './InsightsPage.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & types
// ─────────────────────────────────────────────────────────────────────────────

const FUTURE_LIMIT = 14;             // days ahead user can plan
const PAST_LIMIT   = 365;            // days back with data

type Range = 'Week' | 'Month' | 'Year';
type BarStatus = 'ok' | 'today' | 'future' | 'nodata';

interface Stats { cal: number; protein: number; carbs: number; fat: number; }

interface BarItem {
  key: string;
  label: string;
  sublabel?: string;
  status: BarStatus;
  cal: number; protein: number; carbs: number; fat: number;
  diaryOffset?: number;
  drillWeek?: Date;
  drillMonth?: Date;
}

interface HistoryEntry { range: Range; weekStart: Date; monthDate: Date; yearNum: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

function norm(d: Date): Date { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d: Date, n: number): Date { const r = norm(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date): number {
  return Math.round((norm(a).getTime() - norm(b).getTime()) / 86400000);
}
function weekMonday(d: Date): Date {
  const r = norm(d);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}

const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MO_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─────────────────────────────────────────────────────────────────────────────
// Day-level data
// ─────────────────────────────────────────────────────────────────────────────

function realDayStatus(d: Date, today: Date): BarStatus {
  const diff = diffDays(d, today);
  if (diff === 0)          return 'today';
  if (diff > FUTURE_LIMIT) return 'nodata';
  if (diff > 0)            return 'future';
  if (diff < -PAST_LIMIT)  return 'nodata';
  return 'ok';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar builders
// ─────────────────────────────────────────────────────────────────────────────

type DayStatsFn = (d: Date) => Stats & { status: BarStatus };

function buildWeekBars(weekStart: Date, dayStats: DayStatsFn): BarItem[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const s = dayStats(d);
    return {
      key:     `w${i}`,
      label:   WD_SHORT[i],
      sublabel: String(d.getDate()),
      status:  s.status,
      cal: s.cal, protein: s.protein, carbs: s.carbs, fat: s.fat,
      // all days navigable to diary (even no-data, to add food)
      diaryOffset: diffDays(d, getInsightsBaseDate()),
    };
  });
}

function buildMonthBars(year: number, month: number, dayStats: DayStatsFn): BarItem[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  let ws = weekMonday(firstDay);
  const bars: BarItem[] = [];
  let wn = 1;

  while (ws <= lastDay) {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const inMonth  = weekDays.filter(d => d.getMonth() === month);
    const stats    = inMonth.map(d => dayStats(d));

    const hasData    = stats.some(s => s.cal > 0);
    const allNoData  = stats.every(s => s.status === 'nodata');
    const allFuture  = stats.every(s => s.status === 'future' || s.status === 'nodata');
    const hasCurrent = stats.some(s => s.status === 'today');

    const valid = stats.filter(s => s.cal > 0);
    const avg = (k: keyof Stats) =>
      valid.length > 0 ? Math.round(valid.reduce((a, s) => a + s[k], 0) / valid.length) : 0;

    const status: BarStatus = allNoData ? 'nodata' : allFuture ? 'future' : hasCurrent ? 'today' : 'ok';

    bars.push({
      key:      `mwk${wn}`,
      label:    `Wk ${wn}`,
      sublabel: `${inMonth[0].getDate()}–${inMonth[inMonth.length - 1].getDate()}`,
      status,
      cal:     hasData ? avg('cal') : 0,
      protein: hasData ? avg('protein') : 0,
      carbs:   hasData ? avg('carbs') : 0,
      fat:     hasData ? avg('fat') : 0,
      drillWeek: (status !== 'nodata') ? new Date(ws) : undefined,
    });

    ws = addDays(ws, 7);
    wn++;
  }
  return bars;
}

function buildYearBars(year: number, dayStats: DayStatsFn): BarItem[] {
  const today = getInsightsBaseDate();
  const curMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const dataStart     = new Date(today.getFullYear() - 1, today.getMonth(), 1);

  return Array.from({ length: 12 }, (_, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const isFuture = firstDay > curMonthStart;
    const isNoData = firstDay < dataStart;
    const isCur    = year === today.getFullYear() && month === today.getMonth();

    if (isFuture || isNoData) {
      return {
        key: `y${month}`, label: MO_SHORT[month],
        status: (isFuture ? 'future' : 'nodata') as BarStatus,
        cal: 0, protein: 0, carbs: 0, fat: 0,
      };
    }

    const days: Stats[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const s = dayStats(new Date(d));
      if (s.cal > 0) days.push(s);
    }
    const avg = (k: keyof Stats) =>
      days.length > 0 ? Math.round(days.reduce((a, s) => a + s[k], 0) / days.length) : 0;

    return {
      key:      `y${month}`,
      label:    MO_SHORT[month],
      status:   isCur ? 'today' : 'ok',
      cal:     avg('cal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat'),
      drillMonth: new Date(year, month, 1),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI computation
// ─────────────────────────────────────────────────────────────────────────────

function computeKPIs(bars: BarItem[], calGoal: number, proteinGoal: number) {
  const active = bars.filter(b => b.cal > 0);
  const avg         = active.length > 0 ? Math.round(active.reduce((s, b) => s + b.cal, 0) / active.length) : 0;
  const onTarget    = active.filter(b => b.cal <= calGoal).length;
  const adherence   = active.length > 0 ? onTarget / active.length : 0;
  const proteinHit  = active.filter(b => b.protein >= proteinGoal).length;
  return { avg, onTarget, adherence, proteinHit, total: active.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation helpers
// ─────────────────────────────────────────────────────────────────────────────

function periodLabel(range: Range, ws: Date, md: Date, yn: number): string {
  if (range === 'Week') {
    const we = addDays(ws, 6);
    const sm = MO_SHORT[ws.getMonth()], em = MO_SHORT[we.getMonth()];
    if (sm === em) return `${ws.getDate()}–${we.getDate()} ${sm} ${ws.getFullYear()}`;
    return `${ws.getDate()} ${sm} – ${we.getDate()} ${em} ${ws.getFullYear()}`;
  }
  if (range === 'Month') return `${MO_LONG[md.getMonth()]} ${md.getFullYear()}`;
  return String(yn);
}

function canPrev(range: Range, ws: Date, md: Date, yn: number): boolean {
  const today = getInsightsBaseDate();
  if (range === 'Week')  return diffDays(weekMonday(today), addDays(ws, -7)) <= PAST_LIMIT;
  if (range === 'Month') {
    const prev = new Date(md.getFullYear(), md.getMonth() - 1, 1);
    return prev >= new Date(today.getFullYear() - 1, today.getMonth(), 1);
  }
  return yn > today.getFullYear() - 2;
}

function canNext(range: Range, ws: Date, md: Date, yn: number): boolean {
  const today = getInsightsBaseDate();
  if (range === 'Week')  return diffDays(addDays(ws, 7), weekMonday(today)) <= FUTURE_LIMIT;
  if (range === 'Month') {
    const next = new Date(md.getFullYear(), md.getMonth() + 1, 1);
    return next <= new Date(today.getFullYear(), today.getMonth(), 1);
  }
  return yn < today.getFullYear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function BarChart({ bars, goal, onClickBar }: {
  bars: BarItem[];
  goal: number;
  onClickBar: (bar: BarItem) => void;
}) {
  const maxVal = Math.max(goal, ...bars.map(b => b.cal), 100) * 1.1;
  const hasData = bars.some(b => b.cal > 0);

  return (
    <div className={styles.bars}>
      <div className={styles.barsPlot}>
        {hasData && (
          <div className={styles.goalLine} style={{ bottom: `${(goal / maxVal) * 100}%` }}>
            <span className={styles.goalLineLabel}>Goal {goal.toLocaleString()}</span>
          </div>
        )}

        {bars.map((bar) => {
          const hpct  = bar.cal > 0 ? (bar.cal / maxVal) * 100 : 0;
          const over  = bar.status === 'ok' && bar.cal > goal;
          const isClickable = (
            bar.diaryOffset !== undefined ||
            bar.drillWeek  !== undefined  ||
            bar.drillMonth !== undefined
          );

          return (
            <button
              key={bar.key}
              className={[
                styles.barCol,
                bar.status === 'nodata'  ? styles.barNoData  : '',
                bar.status === 'future'  ? styles.barFuture  : '',
                bar.status === 'today'   ? styles.barToday   : '',
                isClickable              ? styles.barClick   : '',
              ].join(' ')}
              onClick={() => isClickable && onClickBar(bar)}
              disabled={!isClickable}
            >
              <div className={styles.barVal}>
                {bar.status === 'nodata' ? '—' :
                 bar.status === 'future' ? ''  :
                 bar.cal > 0             ? `${(bar.cal / 1000).toFixed(1)}k` : '—'}
              </div>

              <div className={styles.barTrack}>
                {bar.status === 'nodata'
                  ? <div className={styles.barNoDash} />
                  : <div className={[
                      styles.barFill,
                      over ? styles.barOver : '',
                      bar.status === 'today'  ? styles.barCurrent : '',
                      bar.status === 'future' ? styles.barFutFill : '',
                    ].join(' ')}
                    style={{ height: `${hpct}%` }}
                  />
                }
              </div>

              <div className={[styles.barLabel, bar.status === 'today' ? styles.barLabelToday : ''].join(' ')}>
                {bar.label}
              </div>
              {bar.sublabel && <div className={styles.barSub}>{bar.sublabel}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MacroDonut({ p, c, f }: { p: number; c: number; f: number }) {
  const size = 132;
  const cals = { p: p * 4, c: c * 4, f: f * 9 };
  const tot  = cals.p + cals.c + cals.f || 1;
  const segs = [
    { v: cals.p / tot, color: 'var(--protein)' },
    { v: cals.c / tot, color: 'var(--carbs)'   },
    { v: cals.f / tot, color: 'var(--fat)'     },
  ];
  const r = (size - 18) / 2, C = 2 * Math.PI * r;
  let off = 0;

  return (
    <div className={styles.donut} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {segs.map((s, i) => {
          const len = s.v * C;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={s.color} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size/2} ${size/2})`} />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className={styles.donutCenter}>
        <b>{Math.round(segs[0].v * 100)}/{Math.round(segs[1].v * 100)}/{Math.round(segs[2].v * 100)}</b>
        <span>P / C / F</span>
      </div>
    </div>
  );
}

function TrendLine({ values, labels }: { values: number[]; labels: string[] }) {
  const valid = values.filter(v => v > 0);
  if (valid.length < 2) {
    return <div className={styles.trendEmpty}>Not enough data yet</div>;
  }

  // Only draw up to the last non-zero index
  const lastIdx = values.reduce((a, v, i) => (v > 0 ? i : a), 0);
  const slice   = values.slice(0, lastIdx + 1);
  const w = 640, h = 150;
  const mn = Math.min(...slice) - 60, mx = Math.max(...slice) + 60;

  const pts = slice.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - mn) / (mx - mn)) * h;
    return [x, y] as [number, number];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1][0]} ${h} L 0 ${h} Z`;

  return (
    <>
      <svg className={styles.trendSvg} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendGrad)" />
        <path d={path} fill="none" stroke="var(--green)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]}
          r="4" fill="var(--green)" stroke="#fff" strokeWidth="2"
          vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.trendAxis}>
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className={styles.legendItem}>
      <span className={styles.legendDot} style={{ background: color }} />
      <span className={styles.legendLabel}>{label}</span>
      <span className={styles.legendValue}>{value}</span>
    </div>
  );
}

function ChevLeft() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevRight() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export interface InsightsSnapshot {
  range: Range;
  weekStart: Date;
  monthDate: Date;
  yearNum: number;
}

interface InsightsPageProps {
  onOpenDay?: (offset: number, snapshot: InsightsSnapshot) => void;
  initialState?: InsightsSnapshot;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getInsightsBaseDate(): Date {
  return new Date();
}

export function InsightsPage({ onOpenDay, initialState }: InsightsPageProps) {
  const goals       = useProfileStore((s) => s.goals);
  const calGoal     = goals.calories || 2000;
  const proteinGoal = goals.protein  || 120;
  const baseToday    = getInsightsBaseDate();

  const [range,     setRange]     = useState<Range>(initialState?.range ?? 'Week');
  const [weekStart, setWeekStart] = useState<Date>(initialState?.weekStart ?? weekMonday(baseToday));
  const [monthDate, setMonthDate] = useState<Date>(initialState?.monthDate ?? new Date(baseToday.getFullYear(), baseToday.getMonth(), 1));
  const [yearNum,   setYearNum]   = useState<number>(initialState?.yearNum ?? baseToday.getFullYear());
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [streak, setStreak]       = useState<number | null>(null);

  // Cache of real per-day stats fetched from API: key = YYYY-MM-DD
  const [apiDayCache, setApiDayCache] = useState<Map<string, Stats>>(new Map());

  // Fetch a date range from the API and merge into cache
  const fetchRange = useCallback(async (from: Date, to: Date) => {
    try {
      const raw = await mealApi.getHistory(isoDate(from), isoDate(to));
      if (!raw) return;
      const byDate = new Map<string, Stats>();
      for (const r of raw) {
        const dateKey = r.loggedAt.slice(0, 10);
        const existing = byDate.get(dateKey) ?? { cal: 0, protein: 0, carbs: 0, fat: 0 };
        byDate.set(dateKey, {
          cal:     existing.cal     + Math.round(r.calories),
          protein: existing.protein + Math.round(r.proteinGrams),
          carbs:   existing.carbs   + Math.round(r.carbsGrams),
          fat:     existing.fat     + Math.round(r.fatGrams),
        });
      }
      setApiDayCache((prev) => new Map([...prev, ...byDate]));
    } catch { /* keep cached data */ }
  }, []);

  // Fetch when visible range changes
  useEffect(() => {
    if (range === 'Week') {
      fetchRange(weekStart, addDays(weekStart, 6));
    } else if (range === 'Month') {
      const from = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const to   = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      fetchRange(from, to);
    } else {
      // Year: fetch full year
      fetchRange(new Date(yearNum, 0, 1), new Date(yearNum, 11, 31));
    }
  }, [range, weekStart, monthDate, yearNum, fetchRange]);

  useEffect(() => {
    analyticsApi.getStreak().then((response) => {
      if (response) setStreak(response.streak);
    }).catch(() => {});
  }, []);

  // ── dayStats function — uses API cache ────────
  const dayStats = useCallback((d: Date): Stats & { status: BarStatus } => {
    const today = getInsightsBaseDate();
    const key = isoDate(d);
    const cached = apiDayCache.get(key);
    const status = realDayStatus(d, today);
    if (cached) return { ...cached, status: status === 'today' ? 'today' : 'ok' };
    if (status === 'future' || status === 'nodata') {
      return { cal: 0, protein: 0, carbs: 0, fat: 0, status };
    }
    // Data not yet loaded — show as nodata until fetch completes
    return { cal: 0, protein: 0, carbs: 0, fat: 0, status: 'nodata' };
  }, [apiDayCache]);

  // ── Build bar data ────────────────────────────────────────────
  const bars = useMemo(() => {
    if (range === 'Week')  return buildWeekBars(weekStart, dayStats);
    if (range === 'Month') return buildMonthBars(monthDate.getFullYear(), monthDate.getMonth(), dayStats);
    return buildYearBars(yearNum, dayStats);
  }, [range, weekStart, monthDate, yearNum, dayStats]);

  // ── Macro averages ────────────────────────────────────────────
  const active = bars.filter(b => b.cal > 0);
  const macro  = {
    protein: active.length > 0 ? Math.round(active.reduce((s, b) => s + b.protein, 0) / active.length) : 0,
    carbs:   active.length > 0 ? Math.round(active.reduce((s, b) => s + b.carbs,   0) / active.length) : 0,
    fat:     active.length > 0 ? Math.round(active.reduce((s, b) => s + b.fat,     0) / active.length) : 0,
  };

  const kpis      = useMemo(() => computeKPIs(bars, calGoal, proteinGoal), [bars, calGoal, proteinGoal]);
  const yearBars  = useMemo(() => range === 'Year' ? bars : buildYearBars(yearNum, dayStats), [range, bars, yearNum, dayStats]);
  const trendVals = yearBars.map(b => b.cal);
  const trendLbls = yearBars.map(b => b.label);

  // ── Navigation ───────────────────────────────────────────────
  function goPrev() {
    if (range === 'Week')  setWeekStart(w => addDays(w, -7));
    if (range === 'Month') setMonthDate(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    if (range === 'Year')  setYearNum(y => y - 1);
  }
  function goNext() {
    if (range === 'Week')  setWeekStart(w => addDays(w, 7));
    if (range === 'Month') setMonthDate(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    if (range === 'Year')  setYearNum(y => y + 1);
  }

  function switchTab(r: Range) {
    setHistory([]);
    setRange(r);
    setWeekStart(weekMonday(baseToday));
    setMonthDate(new Date(baseToday.getFullYear(), baseToday.getMonth(), 1));
    setYearNum(baseToday.getFullYear());
  }

  function pushHistory() {
    setHistory(h => [...h, { range, weekStart: new Date(weekStart), monthDate: new Date(monthDate), yearNum }]);
  }

  function goBack() {
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setRange(prev.range);
    setWeekStart(prev.weekStart);
    setMonthDate(prev.monthDate);
    setYearNum(prev.yearNum);
  }

  function handleBarClick(bar: BarItem) {
    if (bar.drillMonth !== undefined) {
      pushHistory();
      setRange('Month');
      setMonthDate(bar.drillMonth);
      return;
    }
    if (bar.drillWeek !== undefined) {
      pushHistory();
      setRange('Week');
      setWeekStart(bar.drillWeek);
      return;
    }
    if (bar.diaryOffset !== undefined) {
      onOpenDay?.(bar.diaryOffset, { range, weekStart: new Date(weekStart), monthDate: new Date(monthDate), yearNum });
    }
  }

  const label     = periodLabel(range, weekStart, monthDate, yearNum);
  const hasBack   = history.length > 0;
  const chartTitle =
    range === 'Week'  ? 'Calories this week' :
    range === 'Month' ? 'Weekly breakdown'   : 'Monthly overview';
  const chartHint =
    range === 'Week'  ? 'tap a day to open diary'     :
    range === 'Month' ? 'tap a week to zoom in'       : 'tap a month to view details';

  return (
    <div className={styles.screen}>
      {/* ── Header ── */}
      <header className={styles.head}>
        <div className={styles.headLeft}>
          {hasBack && (
            <button className={styles.backBtn} onClick={goBack}>
              <ChevLeft /> Back
            </button>
          )}
          <div>
            <div className={styles.eyebrow}>Insights</div>
            <h1 className={styles.title}>Your trends</h1>
          </div>
        </div>
        <div className={styles.seg}>
          {(['Week', 'Month', 'Year'] as const).map(r => (
            <button key={r}
              className={[styles.segBtn, range === r ? styles.segOn : ''].join(' ')}
              onClick={() => switchTab(r)}>
              {r}
            </button>
          ))}
        </div>
      </header>

      {/* ── KPI row ── */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Avg daily intake"
          value={kpis.avg > 0 ? kpis.avg.toLocaleString() : '—'}
          unit="kcal"
          delta={kpis.avg > 0 ? `${Math.abs(kpis.avg - calGoal)} kcal ${kpis.avg <= calGoal ? 'below' : 'above'} goal` : 'No data'}
          up={kpis.avg > 0 && kpis.avg <= calGoal}
        />
        <KpiCard
          label="Goal adherence"
          value={kpis.total > 0 ? String(Math.round(kpis.adherence * 100)) : '—'}
          unit="%"
          delta={kpis.total > 0 ? `${kpis.onTarget} of ${kpis.total} days on target` : 'No data'}
          up={kpis.adherence >= 0.7}
        />
        <KpiCard
          label="Protein goal met"
          value={kpis.total > 0 ? String(kpis.proteinHit) : '—'}
          unit={kpis.total > 0 ? `/ ${kpis.total} days` : ''}
          delta={kpis.total > 0 ? `${Math.round(kpis.proteinHit / kpis.total * 100)}% hit rate` : 'No data'}
          up={kpis.total > 0 && kpis.proteinHit / kpis.total >= 0.5}
        />
        <KpiCard
          label="Logging streak"
          value={String(streak ?? '—')}
          unit={streak !== null ? 'days' : ''}
          delta={streak !== null ? 'Current streak' : 'No data'}
        />
      </div>

      {/* ── Charts grid ── */}
      <div className={styles.grid}>
        {/* Bar chart */}
        <section className={`${styles.card} ${styles.wide}`}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.h2}>{chartTitle}</h2>
              <span className={styles.muted}>{chartHint}</span>
            </div>
            <div className={styles.periodNav}>
              <button className={styles.navBtn} onClick={goPrev}
                disabled={!canPrev(range, weekStart, monthDate, yearNum)}>
                <ChevLeft />
              </button>
              <span className={styles.periodLabel}>{label}</span>
              <button className={styles.navBtn} onClick={goNext}
                disabled={!canNext(range, weekStart, monthDate, yearNum)}>
                <ChevRight />
              </button>
            </div>
          </div>
          <BarChart bars={bars} goal={calGoal} onClickBar={handleBarClick} />
        </section>

        {/* Macro donut */}
        {active.length > 0 && (
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Macro split</h2>
              <span className={styles.muted}>{range.toLowerCase()} avg</span>
            </div>
            <div className={styles.macroSplit}>
              <MacroDonut p={macro.protein} c={macro.carbs} f={macro.fat} />
              <div className={styles.macroLegend}>
                <LegendItem color="var(--protein)" label="Protein" value={`${macro.protein} g`} />
                <LegendItem color="var(--carbs)"   label="Carbs"   value={`${macro.carbs} g`}   />
                <LegendItem color="var(--fat)"     label="Fat"     value={`${macro.fat} g`}     />
              </div>
            </div>
          </section>
        )}

        {/* Year trend */}
        {range === 'Year' && (
          <section className={`${styles.card} ${active.length > 0 ? '' : styles.wide}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Monthly trend</h2>
              <span className={styles.muted}>daily average per month</span>
            </div>
            <TrendLine values={trendVals} labels={trendLbls} />
          </section>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit, delta, up }: {
  label: string; value: string; unit: string; delta: string; up?: boolean;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}{unit && <span>{unit}</span>}</div>
      <div className={[styles.kpiDelta, up === true ? styles.deltaUp : up === false ? styles.deltaDown : ''].join(' ')}>
        {delta}
      </div>
    </div>
  );
}
