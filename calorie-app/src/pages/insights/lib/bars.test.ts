import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildMonthBars, buildWeekBars, buildYearBars, computeKPIs, realDayStatus } from './bars';
import { isoDate } from './dates';
import type { DayStatsFn, Stats } from './types';

// Frozen "today": Friday 29 May 2026.
const TODAY = new Date(2026, 4, 29, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});
afterEach(() => {
  vi.useRealTimers();
});

const zero: Stats = { cal: 0, protein: 0, carbs: 0, fat: 0 };

/** Every past day (incl. today) gets the given stats; future days stay empty. */
function statsEveryDay(stats: Stats): DayStatsFn {
  return (d) => {
    const status = realDayStatus(d, new Date());
    if (status === 'ok' || status === 'today') return { ...stats, status };
    return { ...zero, status };
  };
}

describe('realDayStatus', () => {
  it('classifies today, near future, far future and deep past', () => {
    expect(realDayStatus(new Date(2026, 4, 29), TODAY)).toBe('today');
    expect(realDayStatus(new Date(2026, 5, 5), TODAY)).toBe('future');
    expect(realDayStatus(new Date(2026, 5, 13), TODAY)).toBe('nodata'); // > 14 days ahead
    expect(realDayStatus(new Date(2026, 4, 1), TODAY)).toBe('ok');
    expect(realDayStatus(new Date(2025, 4, 1), TODAY)).toBe('nodata'); // > 365 days back
  });
});

describe('buildWeekBars', () => {
  it('produces 7 bars Mon–Sun with diary offsets relative to today', () => {
    const weekStart = new Date(2026, 4, 25); // Mon of the current week
    const bars = buildWeekBars(weekStart, statsEveryDay({ cal: 2000, protein: 100, carbs: 200, fat: 70 }));

    expect(bars).toHaveLength(7);
    expect(bars.map(b => b.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(bars[4].status).toBe('today'); // Friday
    expect(bars[4].diaryOffset).toBe(0);
    expect(bars[0].diaryOffset).toBe(-4);
    expect(bars[6].diaryOffset).toBe(2);
    expect(bars[5].status).toBe('future');
  });
});

describe('buildMonthBars', () => {
  it('splits May 2026 into weeks clipped to the month', () => {
    const bars = buildMonthBars(2026, 4, statsEveryDay({ cal: 1800, protein: 90, carbs: 180, fat: 60 }));

    // May 2026: Fri 1st .. Sun 31st, first week starts Mon 27 Apr -> 5 bars in-month
    expect(bars).toHaveLength(5);
    expect(bars[0].sublabel).toBe('1–3'); // only May days counted in week 1
    expect(bars[4].sublabel).toBe('25–31');
    expect(bars[4].status).toBe('today'); // week containing 29 May
    expect(bars[0].cal).toBe(1800);
  });

  it('handles January weeks that start in the previous year', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));
    const bars = buildMonthBars(2026, 0, statsEveryDay({ cal: 2100, protein: 110, carbs: 210, fat: 70 }));

    // Jan 2026: Thu 1st; the first week (Mon 29 Dec 2025) contributes only 1–4
    expect(bars[0].sublabel).toBe('1–4');
    expect(bars[bars.length - 1].sublabel).toMatch(/–31$/);
    // drillWeek of the first bar is the Monday in the previous year
    expect(isoDate(bars[0].drillWeek as Date)).toBe('2025-12-29');
  });

  it('averages only days that have data', () => {
    const dayStats: DayStatsFn = (d) => {
      const status = realDayStatus(d, new Date());
      if (status !== 'ok' && status !== 'today') return { ...zero, status };
      // Only even days logged, at 2000 kcal
      return d.getDate() % 2 === 0
        ? { cal: 2000, protein: 100, carbs: 200, fat: 70, status }
        : { ...zero, status };
    };
    const bars = buildMonthBars(2026, 4, dayStats);
    // Week 25–31 has data on 26, 28, 30 (28 is even etc.) — average stays 2000
    expect(bars[4].cal).toBe(2000);
  });
});

describe('buildYearBars', () => {
  it('returns 12 bars with future months after the current one', () => {
    const bars = buildYearBars(2026, statsEveryDay({ cal: 1900, protein: 95, carbs: 190, fat: 65 }));

    expect(bars).toHaveLength(12);
    expect(bars[4].status).toBe('today'); // May
    expect(bars[5].status).toBe('future'); // June onward
    expect(bars[11].status).toBe('future');
    expect(bars[4].drillMonth && isoDate(bars[4].drillMonth)).toBe('2026-05-01');
  });

  it('marks months older than a year as nodata', () => {
    const bars = buildYearBars(2025, statsEveryDay({ cal: 1900, protein: 95, carbs: 190, fat: 65 }));
    // Data window starts May 2025 (today minus 1 year)
    expect(bars[3].status).toBe('nodata'); // Apr 2025
    expect(bars[4].status).toBe('ok'); // May 2025
  });

  it('averages a leap-year February over 29 days', () => {
    vi.setSystemTime(new Date(2024, 2, 15, 12, 0, 0)); // 15 Mar 2024
    let counted = 0;
    const dayStats: DayStatsFn = (d) => {
      const status = realDayStatus(d, new Date());
      if (d.getMonth() === 1 && (status === 'ok' || status === 'today')) {
        counted++;
        return { cal: 2000, protein: 100, carbs: 200, fat: 70, status };
      }
      return { ...zero, status };
    };
    const bars = buildYearBars(2024, dayStats);
    expect(counted).toBe(29);
    expect(bars[1].cal).toBe(2000);
  });
});

describe('computeKPIs', () => {
  it('computes averages and adherence over active bars only', () => {
    const bars = [
      { key: 'a', label: 'Mon', status: 'ok' as const, cal: 1800, protein: 130, carbs: 180, fat: 60 },
      { key: 'b', label: 'Tue', status: 'ok' as const, cal: 2200, protein: 90, carbs: 220, fat: 80 },
      { key: 'c', label: 'Wed', status: 'ok' as const, cal: 0, protein: 0, carbs: 0, fat: 0 },
    ];
    const kpis = computeKPIs(bars, 2000, 120);
    expect(kpis.total).toBe(2);
    expect(kpis.avg).toBe(2000);
    expect(kpis.onTarget).toBe(1);
    expect(kpis.adherence).toBe(0.5);
    expect(kpis.proteinHit).toBe(1);
  });

  it('returns zeros when nothing is logged', () => {
    expect(computeKPIs([], 2000, 120)).toEqual({ avg: 0, onTarget: 0, adherence: 0, proteinHit: 0, total: 0 });
  });
});
