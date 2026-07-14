import { describe, it, expect } from 'vitest';
import { addDays, diffDays, isoDate, weekMonday } from './dates';

describe('weekMonday', () => {
  it('returns the same day for a Monday', () => {
    expect(isoDate(weekMonday(new Date(2026, 4, 25)))).toBe('2026-05-25'); // Mon
  });

  it('rolls a Sunday back to the previous Monday', () => {
    expect(isoDate(weekMonday(new Date(2026, 4, 31)))).toBe('2026-05-25');
  });

  it('crosses a month boundary backwards', () => {
    // Wed 1 Jul 2026 -> Mon 29 Jun 2026
    expect(isoDate(weekMonday(new Date(2026, 6, 1)))).toBe('2026-06-29');
  });

  it('crosses a year boundary backwards', () => {
    // Thu 1 Jan 2026 -> Mon 29 Dec 2025
    expect(isoDate(weekMonday(new Date(2026, 0, 1)))).toBe('2025-12-29');
  });
});

describe('addDays / diffDays', () => {
  it('handles the leap day', () => {
    expect(isoDate(addDays(new Date(2024, 1, 28), 1))).toBe('2024-02-29');
    expect(isoDate(addDays(new Date(2024, 1, 29), 1))).toBe('2024-03-01');
  });

  it('diffDays is stable across the DST spring-forward gap', () => {
    // Europe/Berlin loses an hour on 29 Mar 2026; the calendar diff must stay exact.
    expect(diffDays(new Date(2026, 2, 30), new Date(2026, 2, 28))).toBe(2);
  });

  it('diffDays counts a full leap year as 366 days', () => {
    expect(diffDays(new Date(2025, 0, 1), new Date(2024, 0, 1))).toBe(366);
  });
});

describe('isoDate', () => {
  it('zero-pads month and day', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
