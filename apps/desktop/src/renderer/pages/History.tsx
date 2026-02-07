import { useEffect, useState } from 'react';
import { Search, Download, Mail, MessageSquare, CheckCircle, XCircle, Clock, X, Paperclip, RefreshCw } from 'lucide-react';
import type { AuditLog } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { formatDistanceToNow, format, isWithinInterval, parseISO } from 'date-fns';
import DateRangeFilter, { DateRange } from '../components/DateRangeFilter';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';

export default function History() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const toast = useToast();
  const { fmtTime, fmtFullDate } = useDateTimeFormat();

  useEffect(() => {
    loadLogs();
  }, [statusFilter]);

  async function loadLogs() {
    try {
      setLoading(true);
      const filter: Record<string, string> = {};
      if (statusFilter) filter.status = statusFilter;
      const data = await window.envoy.audit.list(filter);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter logs by search and date range
  const filteredLogs = logs.filter((log) => {
    // Search filter
    const matchesSearch =
      log.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      log.recipientAddress.toLowerCase().includes(search.toLowerCase()) ||
      log.templateName.toLowerCase().includes(search.toLowerCase()) ||
      log.subject?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const logDate = parseISO(log.sentAt);
      if (dateRange.from && dateRange.to) {
        if (!isWithinInterval(logDate, { start: dateRange.from, end: dateRange.to })) {
          return false;
        }
      } else if (dateRange.from) {
        if (logDate < dateRange.from) return false;
      } else if (dateRange.to) {
        if (logDate > dateRange.to) return false;
      }
    }

    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getChannelIcon = (channel: string) => {
    return channel === 'whatsapp' ? (
      <MessageSquare className="w-4 h-4 text-green-600" />
    ) : (
      <Mail className="w-4 h-4 text-blue-600" />
    );
  };

  const handleExport = () => {
    try {
      const headers = ['Date', 'Channel', 'Recipient', 'Email/Phone', 'Template', 'Subject', 'Status', 'Error'];
      const rows = filteredLogs.map((log) => [
        log.sentAt,
        log.channel,
        log.recipientName,
        log.recipientAddress,
        log.templateName,
        log.subject || '',
        log.status,
        log.errorMessage || '',
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `message-history-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export complete', `Exported ${filteredLogs.length} records`);
    } catch (error) {
      console.error('Failed to export history:', error);
      toast.error('Export failed', 'Could not export');
    }
  };

  const stats = {
    total: filteredLogs.length,
    sent: filteredLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length,
    failed: filteredLogs.filter((l) => l.status === 'failed').length,
  };

  const statusFilters = [
    { value: '', label: 'All' },
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            History
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats inline */}
        <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span>
            <span className="font-semibold text-gray-900 dark:text-white">{stats.total}</span> total
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>
            <span className="font-semibold text-green-600">{stats.sent}</span> sent
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>
            <span className="font-semibold text-red-600">{stats.failed}</span> failed
          </span>
        </div>
      </div>

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

          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          <div className="flex items-center gap-1">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">
              No messages yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Your sent messages will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="group flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
              >
                {/* Channel Icon */}
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  {getChannelIcon(log.channel)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {log.recipientName}
                    </h3>
                    {getStatusIcon(log.status)}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {log.subject || log.templateName}
                  </p>
                </div>

                {/* Meta */}
                <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {log.templateName}
                  </span>
                  <span className="text-xs text-gray-400 w-24 text-right">
                    {formatDistanceToNow(new Date(log.sentAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {getChannelIcon(selectedLog.channel)}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Message details
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedLog.status)}
                <span className="text-sm font-medium capitalize">{selectedLog.status}</span>
                {selectedLog.errorMessage && (
                  <span className="text-sm text-red-500">- {selectedLog.errorMessage}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase mb-1">Recipient</div>
                  <div className="text-gray-900 dark:text-white font-medium">{selectedLog.recipientName}</div>
                  <div className="text-sm text-gray-500">{selectedLog.recipientAddress}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase mb-1">Sent</div>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {fmtFullDate(new Date(selectedLog.sentAt))}
                  </div>
                  <div className="text-sm text-gray-500">
                    {fmtTime(new Date(selectedLog.sentAt))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 uppercase mb-1">Template</div>
                <div className="text-gray-900 dark:text-white">{selectedLog.templateName}</div>
              </div>

              {selectedLog.subject && (
                <div>
                  <div className="text-xs text-gray-400 uppercase mb-1">Subject</div>
                  <div className="text-gray-900 dark:text-white">{selectedLog.subject}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-400 uppercase mb-1">Preview</div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedLog.bodyPreview}
                </div>
              </div>

              {selectedLog.attachments && selectedLog.attachments.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 uppercase mb-2">Attachments</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.attachments.map((att, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-sm"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {att}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
