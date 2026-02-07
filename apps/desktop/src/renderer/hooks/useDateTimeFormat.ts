import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import {
  resolveTimeFormat,
  resolveDateFormat,
  resolveWeekStart,
  formatTime,
  formatDateDisplay,
  formatShortDate,
  formatShortDateTime,
  formatFullDate,
} from '../utils/dateTimeFormat';

export function useDateTimeFormat() {
  const { settings } = useSettings();

  const timeFmt = useMemo(
    () => resolveTimeFormat(settings.preferences?.timeFormat),
    [settings.preferences?.timeFormat]
  );

  const dateFmt = useMemo(
    () => resolveDateFormat(settings.preferences?.dateFormat),
    [settings.preferences?.dateFormat]
  );

  const weekStartDay = useMemo(
    () => resolveWeekStart(settings.preferences?.weekStart),
    [settings.preferences?.weekStart]
  );

  return {
    timeFmt,
    dateFmt,
    weekStartDay,
    fmtTime: (date: Date) => formatTime(date, timeFmt),
    fmtDate: (date: Date) => formatDateDisplay(date, dateFmt),
    fmtShortDate: (date: Date) => formatShortDate(date, dateFmt),
    fmtShortDateTime: (date: Date) => formatShortDateTime(date, dateFmt, timeFmt),
    fmtFullDate: (date: Date) => formatFullDate(date, dateFmt),
  };
}
