import { format } from 'date-fns';
import type { TimeFormat, DateFormat, WeekStart } from '@shared/types';

// ============================================
// SYSTEM DETECTION
// ============================================

export function getSystemTimeIs24h(): boolean {
  const formatted = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, 14));
  return formatted.includes('14');
}

export function getSystemDateOrder(): 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' {
  const formatted = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(2000, 11, 25));
  if (formatted.startsWith('2000')) return 'YYYY-MM-DD';
  if (formatted.startsWith('25')) return 'DD/MM/YYYY';
  return 'MM/DD/YYYY';
}

export function getSystemWeekStart(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  // Use Intl.Locale if available (modern browsers)
  try {
    const locale = new Intl.Locale(navigator.language) as any;
    if (locale.weekInfo?.firstDay !== undefined) {
      const day = locale.weekInfo.firstDay;
      // ISO: 1=Mon, 2=Tue, ..., 7=Sun → date-fns: 0=Sun, 1=Mon, ..., 6=Sat
      return (day % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
  } catch {
    // fallback
  }
  return 0; // Default to Sunday
}

// ============================================
// RESOLVE PREFERENCES
// ============================================

export function resolveTimeFormat(pref: TimeFormat | undefined): '12h' | '24h' {
  if (!pref || pref === 'system') return getSystemTimeIs24h() ? '24h' : '12h';
  return pref;
}

export function resolveDateFormat(pref: DateFormat | undefined): 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' {
  if (!pref || pref === 'system') return getSystemDateOrder();
  return pref;
}

const WEEK_START_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export function resolveWeekStart(pref: WeekStart | undefined): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (!pref || pref === 'system') return getSystemWeekStart();
  return WEEK_START_MAP[pref] ?? 0;
}

// ============================================
// FORMAT HELPERS
// ============================================

export function formatTime(date: Date, timeFmt: '12h' | '24h'): string {
  return timeFmt === '24h' ? format(date, 'HH:mm') : format(date, 'h:mm a');
}

export function formatDateDisplay(date: Date, dateFmt: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'): string {
  const dayName = format(date, 'EEEE');
  switch (dateFmt) {
    case 'DD/MM/YYYY': return `${dayName}, ${format(date, 'd MMMM yyyy')}`;
    case 'YYYY-MM-DD': return `${dayName}, ${format(date, 'yyyy-MM-dd')}`;
    default: return `${dayName}, ${format(date, 'MMMM d, yyyy')}`;
  }
}

export function formatShortDate(date: Date, dateFmt: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'): string {
  switch (dateFmt) {
    case 'DD/MM/YYYY': return format(date, 'd MMM');
    case 'YYYY-MM-DD': return format(date, 'yyyy-MM-dd');
    default: return format(date, 'MMM d');
  }
}

export function formatShortDateTime(date: Date, dateFmt: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD', timeFmt: '12h' | '24h'): string {
  return `${formatShortDate(date, dateFmt)}, ${formatTime(date, timeFmt)}`;
}

export function formatFullDate(date: Date, dateFmt: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'): string {
  switch (dateFmt) {
    case 'DD/MM/YYYY': return format(date, 'd MMM yyyy');
    case 'YYYY-MM-DD': return format(date, 'yyyy-MM-dd');
    default: return format(date, 'MMM d, yyyy');
  }
}
