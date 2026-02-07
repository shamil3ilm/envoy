import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export default function DateRangeFilter({ value, onChange, className = '' }: DateRangeFilterProps) {
  const { weekStartDay } = useDateTimeFormat();

  const PRESETS = useMemo(() => [
    { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { label: 'Yesterday', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
    { label: 'Last 7 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
    { label: 'Last 30 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
    { label: 'This week', getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: weekStartDay }), to: endOfWeek(new Date(), { weekStartsOn: weekStartDay }) }) },
    { label: 'This month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'This year', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  ], [weekStartDay]);
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState(value.from ? format(value.from, 'yyyy-MM-dd') : '');
  const [toDate, setToDate] = useState(value.to ? format(value.to, 'yyyy-MM-dd') : '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync local state with prop changes
  useEffect(() => {
    setFromDate(value.from ? format(value.from, 'yyyy-MM-dd') : '');
    setToDate(value.to ? format(value.to, 'yyyy-MM-dd') : '');
  }, [value]);

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    const range = preset.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const handleApply = () => {
    const from = fromDate ? startOfDay(new Date(fromDate)) : null;
    const to = toDate ? endOfDay(new Date(toDate)) : null;
    onChange({ from, to });
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange({ from: null, to: null });
    setFromDate('');
    setToDate('');
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (!value.from && !value.to) {
      return 'All time';
    }
    if (value.from && value.to) {
      // Check if it matches a preset
      const today = new Date();
      if (format(value.from, 'yyyy-MM-dd') === format(startOfDay(today), 'yyyy-MM-dd') &&
          format(value.to, 'yyyy-MM-dd') === format(endOfDay(today), 'yyyy-MM-dd')) {
        return 'Today';
      }
      if (format(value.from, 'yyyy-MM-dd') === format(startOfMonth(today), 'yyyy-MM-dd') &&
          format(value.to, 'yyyy-MM-dd') === format(endOfMonth(today), 'yyyy-MM-dd')) {
        return 'This month';
      }
      if (format(value.from, 'yyyy-MM-dd') === format(startOfYear(today), 'yyyy-MM-dd') &&
          format(value.to, 'yyyy-MM-dd') === format(endOfYear(today), 'yyyy-MM-dd')) {
        return 'This year';
      }
      return `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d, yyyy')}`;
    }
    if (value.from) {
      return `From ${format(value.from, 'MMM d, yyyy')}`;
    }
    return `Until ${format(value.to!, 'MMM d, yyyy')}`;
  };

  const hasFilter = value.from || value.to;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
          hasFilter
            ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)] border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <Calendar className="w-4 h-4" />
        <span>{getDisplayText()}</span>
        {hasFilter ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-0.5 hover:bg-primary-100 dark:hover:bg-primary-800 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-[320px]">
          {/* Presets */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-400 uppercase px-2 pb-2">Quick select</div>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom range */}
          <div className="p-4">
            <div className="text-xs text-gray-400 uppercase mb-3">Custom range</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
