import { addDays, diffDays, getInsightsBaseDate, weekMonday, MO_SHORT, WD_SHORT } from './dates';
import { FUTURE_LIMIT, PAST_LIMIT } from './types';
import type { BarItem, BarStatus, DayStatsFn, Stats } from './types';

export function realDayStatus(d: Date, today: Date): BarStatus {
  const diff = diffDays(d, today);
  if (diff === 0)          return 'today';
  if (diff > FUTURE_LIMIT) return 'nodata';
  if (diff > 0)            return 'future';
  if (diff < -PAST_LIMIT)  return 'nodata';
  return 'ok';
}

export function buildWeekBars(weekStart: Date, dayStats: DayStatsFn): BarItem[] {
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

export function buildMonthBars(year: number, month: number, dayStats: DayStatsFn): BarItem[] {
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

export function buildYearBars(year: number, dayStats: DayStatsFn): BarItem[] {
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

export function computeKPIs(bars: BarItem[], calGoal: number, proteinGoal: number) {
  const active = bars.filter(b => b.cal > 0);
  const avg         = active.length > 0 ? Math.round(active.reduce((s, b) => s + b.cal, 0) / active.length) : 0;
  const onTarget    = active.filter(b => b.cal <= calGoal).length;
  const adherence   = active.length > 0 ? onTarget / active.length : 0;
  const proteinHit  = active.filter(b => b.protein >= proteinGoal).length;
  return { avg, onTarget, adherence, proteinHit, total: active.length };
}
