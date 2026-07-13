import { addDays, diffDays, getInsightsBaseDate, weekMonday, MO_LONG, MO_SHORT } from './dates';
import { FUTURE_LIMIT, PAST_LIMIT } from './types';
import type { Range } from './types';

export function periodLabel(range: Range, ws: Date, md: Date, yn: number): string {
  if (range === 'Week') {
    const we = addDays(ws, 6);
    const sm = MO_SHORT[ws.getMonth()], em = MO_SHORT[we.getMonth()];
    if (sm === em) return `${ws.getDate()}–${we.getDate()} ${sm} ${ws.getFullYear()}`;
    return `${ws.getDate()} ${sm} – ${we.getDate()} ${em} ${ws.getFullYear()}`;
  }
  if (range === 'Month') return `${MO_LONG[md.getMonth()]} ${md.getFullYear()}`;
  return String(yn);
}

export function canPrev(range: Range, ws: Date, md: Date, yn: number): boolean {
  const today = getInsightsBaseDate();
  if (range === 'Week')  return diffDays(weekMonday(today), addDays(ws, -7)) <= PAST_LIMIT;
  if (range === 'Month') {
    const prev = new Date(md.getFullYear(), md.getMonth() - 1, 1);
    return prev >= new Date(today.getFullYear() - 1, today.getMonth(), 1);
  }
  return yn > today.getFullYear() - 2;
}

export function canNext(range: Range, ws: Date, md: Date, yn: number): boolean {
  const today = getInsightsBaseDate();
  if (range === 'Week')  return diffDays(addDays(ws, 7), weekMonday(today)) <= FUTURE_LIMIT;
  if (range === 'Month') {
    const next = new Date(md.getFullYear(), md.getMonth() + 1, 1);
    return next <= new Date(today.getFullYear(), today.getMonth(), 1);
  }
  return yn < today.getFullYear();
}
