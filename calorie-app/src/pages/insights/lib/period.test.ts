import { describe, it, expect } from 'vitest';
import { periodLabel } from './period';

describe('periodLabel (Week)', () => {
  it('formats a week inside one month with a single year', () => {
    expect(periodLabel('Week', new Date(2026, 4, 25), new Date(), 0)).toBe('25–31 May 2026');
  });

  it('formats a week crossing a month boundary with the end year', () => {
    // Mon 28 Apr – Sun 4 May 2026
    expect(periodLabel('Week', new Date(2026, 3, 27), new Date(), 0)).toBe('27 Apr – 3 May 2026');
  });

  it('shows both years for a week crossing a year boundary', () => {
    // Mon 29 Dec 2025 – Sun 4 Jan 2026
    expect(periodLabel('Week', new Date(2025, 11, 29), new Date(), 0)).toBe(
      '29 Dec 2025 – 4 Jan 2026',
    );
  });
});
