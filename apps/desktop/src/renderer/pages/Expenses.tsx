import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
  Trash2,
  Edit2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Minus,
  ChevronDown,
} from 'lucide-react';
import type { Expense, ExpenseSummary, CreateExpenseInput } from '@shared/types';
import { CURRENCIES } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { useActivityLog } from '../hooks/useActivityLog';
import { useUserProfiles } from '../hooks/useUserProfiles';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';
import { ICON_MAP } from '../utils/iconMap';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  addMonths,
  addWeeks,
  addYears,
  subMonths,
  subWeeks,
  subYears,
  subDays,
  differenceInDays,
  isSameMonth,
  isSameWeek,
  isSameYear,
} from 'date-fns';

type ViewPeriod = 'week' | 'month' | 'year' | 'custom';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Period state
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [compareTarget, setCompareTarget] = useState('previous');
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [comparisonSummary, setComparisonSummary] = useState<ExpenseSummary | null>(null);
  const [comparisonLabel, setComparisonLabel] = useState('');

  // Editor state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Custom category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6b7280');

  const toast = useToast();
  const { preferences, updatePreferences } = useSettings();
  const { allExpenseCategories } = useUserProfiles();
  const { logExpenseCreated, logExpenseDeleted } = useActivityLog();
  const { weekStartDay } = useDateTimeFormat();

  // Calculate date range based on view period
  const getDateRange = () => {
    switch (viewPeriod) {
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: weekStartDay }),
          end: endOfWeek(currentDate, { weekStartsOn: weekStartDay }),
        };
      case 'year':
        return {
          start: startOfYear(currentDate),
          end: endOfYear(currentDate),
        };
      case 'custom':
        return {
          start: customFrom ? new Date(customFrom) : startOfMonth(currentDate),
          end: customTo ? new Date(customTo) : endOfMonth(currentDate),
        };
      case 'month':
      default:
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        };
    }
  };

  const { start: periodStart, end: periodEnd } = getDateRange();

  // Format period label
  const getPeriodLabel = () => {
    switch (viewPeriod) {
      case 'week':
        return `${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')}`;
      case 'year':
        return format(currentDate, 'yyyy');
      case 'custom':
        if (customFrom && customTo) return `${format(new Date(customFrom), 'MMM d')} - ${format(new Date(customTo), 'MMM d, yyyy')}`;
        if (customFrom) return `From ${format(new Date(customFrom), 'MMM d, yyyy')}`;
        if (customTo) return `Until ${format(new Date(customTo), 'MMM d, yyyy')}`;
        return 'Select dates';
      case 'month':
      default:
        return format(currentDate, 'MMMM yyyy');
    }
  };

  // Check if current period is the current period (today's week/month/year)
  const isCurrentPeriod = () => {
    if (viewPeriod === 'custom') return true;
    const today = new Date();
    switch (viewPeriod) {
      case 'week':
        return isSameWeek(currentDate, today, { weekStartsOn: weekStartDay });
      case 'year':
        return isSameYear(currentDate, today);
      case 'month':
      default:
        return isSameMonth(currentDate, today);
    }
  };

  // Navigate periods
  const goToPreviousPeriod = () => {
    switch (viewPeriod) {
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(subYears(currentDate, 1));
        break;
      case 'month':
      default:
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const goToNextPeriod = () => {
    switch (viewPeriod) {
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(addYears(currentDate, 1));
        break;
      case 'month':
      default:
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Reset compare target when view period changes (options differ per period)
  useEffect(() => {
    setCompareTarget('previous');
  }, [viewPeriod]);

  // Comparison target options based on current view period
  const compareOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    switch (viewPeriod) {
      case 'week':
        opts.push(
          { value: 'previous', label: 'Previous week' },
          { value: '2_ago', label: '2 weeks ago' },
          { value: '4_ago', label: '4 weeks ago' },
          { value: 'same_last_year', label: 'Same week last year' },
        );
        break;
      case 'month':
        opts.push(
          { value: 'previous', label: 'Previous month' },
          { value: '2_ago', label: '2 months ago' },
          { value: '3_ago', label: '3 months ago' },
          { value: 'same_last_year', label: 'Same month last year' },
        );
        break;
      case 'year':
        opts.push(
          { value: 'previous', label: 'Previous year' },
          { value: '2_ago', label: '2 years ago' },
          { value: '3_ago', label: '3 years ago' },
        );
        break;
      case 'custom':
        opts.push(
          { value: 'previous', label: 'Previous period (same duration)' },
        );
        break;
    }
    opts.push({ value: 'custom_range', label: 'Custom range...' });
    return opts;
  }, [viewPeriod]);

  // Get the comparison period date range
  const getComparisonRange = () => {
    // Custom range comparison — works with any view period
    if (compareTarget === 'custom_range') {
      if (!compareFrom || !compareTo) return null;
      const s = new Date(compareFrom);
      const e = new Date(compareTo);
      return { start: s, end: e, label: `${format(s, 'MMM d')} - ${format(e, 'MMM d, yyyy')}` };
    }

    const formatWeekRange = (d: Date) => {
      const s = startOfWeek(d, { weekStartsOn: weekStartDay });
      const e = endOfWeek(d, { weekStartsOn: weekStartDay });
      return { start: s, end: e, label: `${format(s, 'MMM d')} - ${format(e, 'MMM d, yyyy')}` };
    };
    const formatMonthRange = (d: Date) => ({ start: startOfMonth(d), end: endOfMonth(d), label: format(d, 'MMMM yyyy') });
    const formatYearRange = (d: Date) => ({ start: startOfYear(d), end: endOfYear(d), label: format(d, 'yyyy') });

    switch (viewPeriod) {
      case 'week': {
        if (compareTarget === 'same_last_year') return formatWeekRange(subYears(currentDate, 1));
        const n = compareTarget === '4_ago' ? 4 : compareTarget === '2_ago' ? 2 : 1;
        return formatWeekRange(subWeeks(currentDate, n));
      }
      case 'month': {
        if (compareTarget === 'same_last_year') return formatMonthRange(subYears(currentDate, 1));
        const n = compareTarget === '3_ago' ? 3 : compareTarget === '2_ago' ? 2 : 1;
        return formatMonthRange(subMonths(currentDate, n));
      }
      case 'year': {
        const n = compareTarget === '3_ago' ? 3 : compareTarget === '2_ago' ? 2 : 1;
        return formatYearRange(subYears(currentDate, n));
      }
      case 'custom': {
        if (!customFrom || !customTo) return null;
        const days = differenceInDays(new Date(customTo), new Date(customFrom));
        const prevEnd = subDays(new Date(customFrom), 1);
        const prevStart = subDays(prevEnd, days);
        return { start: prevStart, end: prevEnd, label: `${format(prevStart, 'MMM d')} - ${format(prevEnd, 'MMM d, yyyy')}` };
      }
    }
  };

  useEffect(() => {
    if (viewPeriod === 'custom' && (!customFrom || !customTo)) return;
    loadData();
  }, [categoryFilter, viewPeriod, currentDate, customFrom, customTo, showComparison, compareTarget, compareFrom, compareTo]);

  async function loadData() {
    try {
      setLoading(true);
      const filter: { category?: string; fromDate?: string; toDate?: string } = {};
      if (categoryFilter) filter.category = categoryFilter;

      // Apply date range filter
      filter.fromDate = format(periodStart, 'yyyy-MM-dd');
      filter.toDate = format(periodEnd, 'yyyy-MM-dd');

      const promises: Promise<any>[] = [
        window.envoy.expenses.list(filter as Parameters<typeof window.envoy.expenses.list>[0]),
        window.envoy.expenses.summary({
          fromDate: filter.fromDate,
          toDate: filter.toDate,
        }),
      ];

      // Load comparison data if enabled
      if (showComparison) {
        const compRange = getComparisonRange();
        if (compRange) {
          promises.push(
            window.envoy.expenses.summary({
              fromDate: format(compRange.start, 'yyyy-MM-dd'),
              toDate: format(compRange.end, 'yyyy-MM-dd'),
            })
          );
        }
      }

      const results = await Promise.all(promises);
      setExpenses(results[0]);
      setSummary(results[1]);

      if (showComparison && results[2]) {
        setComparisonSummary(results[2]);
        setComparisonLabel(getComparisonRange()?.label || '');
      } else {
        setComparisonSummary(null);
        setComparisonLabel('');
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredExpenses = expenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateExpense = () => {
    setEditingExpense(null);
    setAmount('');
    setCategory('food');
    setDescription('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setShowEditor(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setDescription(expense.description);
    setDate(expense.date);
    setShowEditor(true);
    setOpenMenuId(null);
  };

  const handleSaveExpense = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Invalid amount', 'Please enter a valid positive number');
      return;
    }
    if (!description.trim()) {
      toast.error('Missing description', 'Please enter a description');
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      if (editingExpense) {
        const updated = await window.envoy.expenses.update(editingExpense.id, {
          amount: amountNum,
          category,
          description: description.trim(),
          date,
        });
        setExpenses(expenses.map((e) => (e.id === updated.id ? updated : e)));
        toast.success('Expense updated', `"${description.trim()}" has been saved`);
      } else {
        const input: CreateExpenseInput = {
          amount: amountNum,
          category,
          description: description.trim(),
          date,
        };
        const created = await window.envoy.expenses.create(input);
        setExpenses([created, ...expenses]);
        toast.success('Expense added', `"${description.trim()}" has been recorded`);
        logExpenseCreated(created.id, description.trim());
      }
      setShowEditor(false);
      loadData(); // Refresh summary
    } catch (error) {
      console.error('Failed to save expense:', error);
      toast.error('Save failed', 'Could not save the expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (deletingId) return;
    if (!confirm(`Delete this expense?`)) return;
    setDeletingId(expense.id);
    try {
      await window.envoy.expenses.delete(expense.id);
      setExpenses(expenses.filter((e) => e.id !== expense.id));
      toast.success('Expense deleted', 'The expense has been removed');
      logExpenseDeleted(expense.id, expense.description);
      loadData(); // Refresh summary
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('Delete failed', 'Could not delete the expense');
    } finally {
      setDeletingId(null);
    }
    setOpenMenuId(null);
  };

  const currency = preferences.currency;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getCategoryIcon = (cat: string) => {
    const catMeta = allExpenseCategories[cat];
    if (!catMeta) return null;
    const Icon = ICON_MAP[catMeta.icon];
    return Icon ? <Icon className="w-4 h-4" /> : null;
  };

  // Helper to get comparison change percentage and direction
  const getChange = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return { percent: 0, direction: 'same' as const };
    if (previous === 0) return { percent: 100, direction: 'up' as const };
    const percent = ((current - previous) / previous) * 100;
    return {
      percent: Math.abs(Math.round(percent)),
      direction: percent > 0 ? 'up' as const : percent < 0 ? 'down' as const : 'same' as const,
    };
  };

  // Calculate category breakdown for display
  const categoryBreakdown = summary
    ? Object.entries(summary.byCategory)
        .filter(([_, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Expenses</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showComparison
                  ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)] text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Compare
            </button>
            {showComparison && (
              <>
                <div className="relative">
                  <select
                    value={compareTarget}
                    onChange={(e) => setCompareTarget(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                  >
                    {compareOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {compareTarget === 'custom_range' && (
                  <>
                    <input
                      type="date"
                      value={compareFrom}
                      onChange={(e) => setCompareFrom(e.target.value)}
                      className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                    />
                    <span className="text-sm text-gray-400">to</span>
                    <input
                      type="date"
                      value={compareTo}
                      onChange={(e) => setCompareTo(e.target.value)}
                      className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                    />
                  </>
                )}
              </>
            )}
            <button
              onClick={handleCreateExpense}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add expense
            </button>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="px-4 sm:px-6 md:px-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Period tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['week', 'month', 'year', 'custom'] as ViewPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setViewPeriod(period)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewPeriod === period
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Period navigation / Custom date inputs */}
          {viewPeriod === 'custom' ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
              />
              {(customFrom || customTo) && (
                <button
                  onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Clear dates"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousPeriod}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>

              <div className="min-w-[180px] text-center">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {getPeriodLabel()}
                </span>
              </div>

              <button
                onClick={goToNextPeriod}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>

              {!isCurrentPeriod() && (
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                >
                  Today
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="px-4 sm:px-6 md:px-8 pb-6">
          {/* Prominent Total Display */}
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                  Total {viewPeriod === 'week' ? 'Weekly' : viewPeriod === 'month' ? 'Monthly' : viewPeriod === 'year' ? 'Yearly' : 'Custom Range'} Expenses
                </div>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(summary.total)}
                  </div>
                  {showComparison && comparisonSummary && (() => {
                    const change = getChange(summary.total, comparisonSummary.total);
                    return (
                      <div className={`flex items-center gap-1 text-sm font-medium ${
                        change.direction === 'up' ? 'text-red-600 dark:text-red-400' :
                        change.direction === 'down' ? 'text-green-600 dark:text-green-400' :
                        'text-gray-500'
                      }`}>
                        {change.direction === 'up' && <TrendingUp className="w-4 h-4" />}
                        {change.direction === 'down' && <TrendingDown className="w-4 h-4" />}
                        {change.direction === 'same' && <Minus className="w-4 h-4" />}
                        {change.percent}%
                      </div>
                    );
                  })()}
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  {getPeriodLabel()} • {expenses.length} transaction{expenses.length !== 1 ? 's' : ''}
                </div>
                {showComparison && comparisonSummary && (
                  <div className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    vs {comparisonLabel}: {formatCurrency(comparisonSummary.total)}
                  </div>
                )}
              </div>
              <div className="text-right">
                {categoryBreakdown.length > 0 && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">Top category</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {allExpenseCategories[categoryBreakdown[0][0]]?.label}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">
                      {formatCurrency(categoryBreakdown[0][1])}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {viewPeriod === 'week' && 'This Week'}
                    {viewPeriod === 'month' && 'This Month'}
                    {viewPeriod === 'year' && 'This Year'}
                    {viewPeriod === 'custom' && 'Custom Range'}
                  </div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(summary.total)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Top Category</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {categoryBreakdown.length > 0
                      ? allExpenseCategories[categoryBreakdown[0][0]]?.label
                      : 'None'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Transactions</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {expenses.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Breakdown by Category
              </h3>
              <div className="space-y-3">
                {categoryBreakdown.map(([cat, catAmount]) => {
                  const percentage = summary.total > 0 ? (catAmount / summary.total) * 100 : 0;
                  const prevCatAmount = showComparison && comparisonSummary ? (comparisonSummary.byCategory[cat] || 0) : 0;
                  const catChange = showComparison && comparisonSummary ? getChange(catAmount, prevCatAmount) : null;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${allExpenseCategories[cat]?.color}20` }}
                      >
                        <span style={{ color: allExpenseCategories[cat]?.color }}>
                          {getCategoryIcon(cat)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {allExpenseCategories[cat]?.label}
                          </span>
                          <div className="flex items-center gap-2">
                            {catChange && (
                              <span className={`text-xs font-medium ${
                                catChange.direction === 'up' ? 'text-red-500' :
                                catChange.direction === 'down' ? 'text-green-500' :
                                'text-gray-400'
                              }`}>
                                {catChange.direction === 'up' ? '+' : catChange.direction === 'down' ? '-' : ''}{catChange.percent}%
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(catAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: allExpenseCategories[cat]?.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="px-4 sm:px-6 md:px-8 pb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                categoryFilter === ''
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              All
            </button>
            {Object.entries(allExpenseCategories).slice(0, 4).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  categoryFilter === key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">
              {search || categoryFilter ? 'No expenses found' : 'No expenses this period'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {search || categoryFilter ? 'Try adjusting your filters' : 'Start tracking your spending'}
            </p>
            {!search && !categoryFilter && (
              <button
                onClick={handleCreateExpense}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
              >
                Add an expense
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="group flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Category Icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${allExpenseCategories[expense.category]?.color}20` }}
                >
                  <span style={{ color: allExpenseCategories[expense.category]?.color }}>
                    {getCategoryIcon(expense.category)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {expense.description}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {allExpenseCategories[expense.category]?.label} · {format(new Date(expense.date), 'MMM d, yyyy')}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(expense.amount)}
                </div>

                {/* Actions */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === expense.id ? null : expense.id);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </button>

                  {openMenuId === expense.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10 min-w-[120px]">
                      <button
                        onClick={() => handleEditExpense(expense)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense)}
                        disabled={deletingId === expense.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === expense.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingExpense ? 'Edit expense' : 'Add expense'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">{CURRENCIES[currency]?.flag || '💵'}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(allExpenseCategories).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="px-2.5 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                    title="Add custom category"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {showAddCategory && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                    <input
                      type="text"
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      placeholder="Category name"
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Color</label>
                      <input
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="w-8 h-6 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
                      />
                      <div className="flex-1" />
                      <button
                        onClick={() => { setShowAddCategory(false); setNewCatLabel(''); }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!newCatLabel.trim()) return;
                          const key = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_');
                          const custom = { ...(preferences.customExpenseCategories || {}), [key]: { label: newCatLabel.trim(), icon: 'Tag', color: newCatColor } };
                          await updatePreferences({ customExpenseCategories: custom });
                          setCategory(key);
                          setShowAddCategory(false);
                          setNewCatLabel('');
                          toast.success('Category added', newCatLabel.trim());
                        }}
                        disabled={!newCatLabel.trim()}
                        className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="What was this expense for?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExpense}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {openMenuId && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
