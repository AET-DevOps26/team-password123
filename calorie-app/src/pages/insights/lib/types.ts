export const FUTURE_LIMIT = 14; // days ahead user can plan
export const PAST_LIMIT = 365; // days back with data

export type Range = 'Week' | 'Month' | 'Year';
export type BarStatus = 'ok' | 'today' | 'future' | 'nodata';

export interface Stats { cal: number; protein: number; carbs: number; fat: number; }

export interface BarItem {
  key: string;
  label: string;
  sublabel?: string;
  status: BarStatus;
  cal: number; protein: number; carbs: number; fat: number;
  diaryOffset?: number;
  drillWeek?: Date;
  drillMonth?: Date;
}

export type DayStatsFn = (d: Date) => Stats & { status: BarStatus };
