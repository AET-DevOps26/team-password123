function norm(d: Date): Date { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
export function addDays(d: Date, n: number): Date { const r = norm(d); r.setDate(r.getDate() + n); return r; }
export function diffDays(a: Date, b: Date): number {
  return Math.round((norm(a).getTime() - norm(b).getTime()) / 86400000);
}
export function weekMonday(d: Date): Date {
  const r = norm(d);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getInsightsBaseDate(): Date {
  return new Date();
}

export const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MO_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const WD_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
