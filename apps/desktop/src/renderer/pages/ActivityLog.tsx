import { useEffect, useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  FileText,
  Users,
  Mail,
  Settings,
  Database,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Bell,
} from 'lucide-react';
import type { UserActivityLog, ActivityCategory } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';

const ITEMS_PER_PAGE = 20;

const CATEGORY_ICONS: Record<ActivityCategory, React.ReactNode> = {
  template: <FileText className="w-4 h-4" />,
  contact: <Users className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  system: <Database className="w-4 h-4" />,
  schedule: <Calendar className="w-4 h-4" />,
  reminder: <Bell className="w-4 h-4" />,
  task: <FileText className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
  snippet: <FileText className="w-4 h-4" />,
  expense: <FileText className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  template: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  contact: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  email: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  document: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  settings: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  system: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  schedule: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  reminder: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  task: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  note: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  snippet: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function ActivityLog() {
  const { fmtTime, fmtShortDateTime, fmtFullDate } = useDateTimeFormat();
  const [logs, setLogs] = useState<UserActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<UserActivityLog | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearDays, setClearDays] = useState('');

  const toast = useToast();

  useEffect(() => {
    loadLogs();
  }, [page, categoryFilter]);

  async function loadLogs() {
    try {
      setLoading(true);
      const filter: Record<string, unknown> = {
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      };
      if (categoryFilter) filter.category = categoryFilter;
      if (search) filter.search = search;

      const result = await window.envoy.activity.list(filter);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    setPage(1);
    loadLogs();
  };

  const handleExport = async () => {
    try {
      const allLogs = await window.envoy.activity.export();
      const headers = ['Date', 'Category', 'Action', 'Description', 'Entity Name', 'Entity ID'];
      const rows = allLogs.map((log) => [
        log.createdAt,
        log.category,
        log.action,
        log.description,
        log.entityName || '',
        log.entityId || '',
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export complete', `Exported ${allLogs.length} activity entries`);
    } catch (error) {
      console.error('Failed to export activity logs:', error);
      toast.error('Export failed', 'Could not export activity logs');
    }
  };

  const handleClearClick = () => {
    setClearDays('');
    setShowClearDialog(true);
  };

  const handleClearConfirm = async () => {
    let beforeDate: string | undefined;
    if (clearDays.trim()) {
      const daysNum = parseInt(clearDays.trim());
      if (isNaN(daysNum) || daysNum < 0) {
        toast.error('Invalid input', 'Please enter a valid number');
        return;
      }
      const date = new Date();
      date.setDate(date.getDate() - daysNum);
      beforeDate = date.toISOString();
    }

    try {
      const deleted = await window.envoy.activity.clear(beforeDate);
      toast.success('Logs cleared', `Removed ${deleted} activity entries`);
      setShowClearDialog(false);
      loadLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast.error('Clear failed', 'Could not clear activity logs');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return fmtShortDateTime(date);
  };

  const formatActivityFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${fmtFullDate(date)} ${fmtTime(date)}`;
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const filteredLogs = search
    ? logs.filter(
        (log) =>
          log.description.toLowerCase().includes(search.toLowerCase()) ||
          log.entityName?.toLowerCase().includes(search.toLowerCase()) ||
          log.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Activity Log
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track all user actions and system events
            </p>
          </div>
        <div className="flex gap-3">
          <button
            onClick={loadLogs}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={total === 0}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleClearClick}
            disabled={total === 0}
            className="btn btn-secondary flex items-center gap-2 text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
      {/* Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="card p-4 col-span-2">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
          <div className="text-sm text-gray-500">Total Activities</div>
        </div>
        {Object.entries(CATEGORY_COLORS).slice(0, 4).map(([cat]) => {
          const count = logs.filter((l) => l.category === cat).length;
          return (
            <div key={cat} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1 rounded ${CATEGORY_COLORS[cat as ActivityCategory]}`}>
                  {CATEGORY_ICONS[cat as ActivityCategory]}
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{count}</div>
              <div className="text-xs text-gray-500 capitalize">{cat}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input pl-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="input w-48"
        >
          <option value="">All Categories</option>
          <option value="template">Templates</option>
          <option value="contact">Contacts</option>
          <option value="email">Email</option>
          <option value="document">Documents</option>
          <option value="schedule">Scheduled</option>
          <option value="reminder">Reminders</option>
          <option value="settings">Settings</option>
          <option value="system">System</option>
        </select>
        <button onClick={handleSearch} className="btn btn-secondary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No activity yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Your actions will be recorded here
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-start gap-4"
              >
                <div
                  className={`p-2 rounded-lg ${CATEGORY_COLORS[log.category as ActivityCategory] || 'bg-gray-100'}`}
                >
                  {CATEGORY_ICONS[log.category as ActivityCategory] || <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {log.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span className="capitalize">{log.action.replace(/_/g, ' ')}</span>
                    {log.entityName && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>{log.entityName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(page * ITEMS_PER_PAGE, total)} of {total} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${CATEGORY_COLORS[selectedLog.category as ActivityCategory] || 'bg-gray-100'}`}
                >
                  {CATEGORY_ICONS[selectedLog.category as ActivityCategory] || <Clock className="w-4 h-4" />}
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Activity Details
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Description</div>
                <div className="text-gray-900 dark:text-white">{selectedLog.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Category</div>
                  <span
                    className={`inline-block px-2 py-1 rounded text-sm capitalize ${
                      CATEGORY_COLORS[selectedLog.category as ActivityCategory] || 'bg-gray-100'
                    }`}
                  >
                    {selectedLog.category}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Action</div>
                  <div className="text-gray-900 dark:text-white capitalize">
                    {selectedLog.action.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Timestamp</div>
                <div className="text-gray-900 dark:text-white">
                  {formatActivityFullDate(selectedLog.createdAt)}
                </div>
              </div>

              {selectedLog.entityName && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Entity</div>
                  <div className="text-gray-900 dark:text-white">{selectedLog.entityName}</div>
                  {selectedLog.entityId && (
                    <div className="text-sm text-gray-500">ID: {selectedLog.entityId}</div>
                  )}
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Additional Details</div>
                  <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Clear Activity Logs
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Enter the number of days to keep. Logs older than this will be deleted.
                Leave empty to clear all logs.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Keep logs from the last (days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={clearDays}
                  onChange={(e) => setClearDays(e.target.value)}
                  placeholder="Leave empty to clear all"
                  className="input"
                />
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  {clearDays.trim()
                    ? `This will delete all logs older than ${clearDays} days.`
                    : 'This will delete ALL activity logs.'}
                  {' '}This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
              <button
                onClick={() => setShowClearDialog(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleClearConfirm}
                className="btn bg-red-600 hover:bg-red-700 text-white"
              >
                Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
