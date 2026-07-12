/**
 * The browser's IANA timezone (e.g. "Europe/Berlin"), sent to the backend as the
 * `tz` query param so day boundaries are bucketed on the user's local calendar
 * instead of UTC. Falls back to "UTC" if the environment can't report a zone.
 */
export function clientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * A date's calendar day in the *local* zone as `YYYY-MM-DD`. Use this — never
 * `toISOString().slice(0, 10)`, which buckets by UTC — when building the `from`/`to`
 * range the backend pairs with the `tz` param, so the requested day matches the
 * calendar the user sees.
 */
export function localIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
