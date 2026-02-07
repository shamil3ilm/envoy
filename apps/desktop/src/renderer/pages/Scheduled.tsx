import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, Users, X, Trash2, RefreshCw, AlertCircle, LayoutList, Kanban, Send, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { ScheduledMessage, ScheduleStatus, Template, Contact } from '@shared/types';
import { useToast } from '../contexts/ToastContext';

type ViewMode = 'list' | 'kanban';

export default function Scheduled() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [templates, setTemplates] = useState<Map<string, Template>>(new Map());
  const [contacts, setContacts] = useState<Map<string, Contact>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ScheduleStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      // Load scheduled messages
      const filterParams = filter === 'all' ? {} : { status: filter as ScheduleStatus };
      const messagesData = await window.envoy.schedule.list(filterParams);
      setMessages(messagesData);

      // Load related templates and contacts
      const templateIds = [...new Set(messagesData.map((m) => m.templateId))];
      const contactIds = [...new Set(messagesData.flatMap((m) => m.recipientIds))];

      const templateMap = new Map<string, Template>();
      const contactMap = new Map<string, Contact>();

      for (const id of templateIds) {
        const template = await window.envoy.templates.get(id);
        if (template) templateMap.set(id, template);
      }

      for (const id of contactIds) {
        const contact = await window.envoy.contacts.get(id);
        if (contact) contactMap.set(id, contact);
      }

      setTemplates(templateMap);
      setContacts(contactMap);
    } catch (error) {
      console.error('Failed to load scheduled messages:', error);
      toast.error('Failed to load', 'Could not load scheduled messages');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCancel(id: string) {
    if (cancellingId) return;
    setCancellingId(id);
    try {
      await window.envoy.schedule.cancel(id);
      toast.success('Cancelled', 'Scheduled message has been cancelled');
      loadData();
    } catch (error) {
      console.error('Failed to cancel scheduled message:', error);
      toast.error('Failed', 'Could not cancel scheduled message');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!confirm('Are you sure you want to delete this scheduled message?')) {
      return;
    }
    setDeletingId(id);
    try {
      await window.envoy.schedule.delete(id);
      toast.success('Deleted', 'Scheduled message has been deleted');
      loadData();
    } catch (error) {
      console.error('Failed to delete scheduled message:', error);
      toast.error('Failed', 'Could not delete scheduled message');
    } finally {
      setDeletingId(null);
    }
  }

  const getStatusBadge = (status: ScheduleStatus) => {
    const styles: Record<ScheduleStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const getRecipientNames = (recipientIds: string[]) => {
    const names = recipientIds
      .map((id) => contacts.get(id)?.name)
      .filter(Boolean);

    if (names.length === 0) {
      return `${recipientIds.length} recipient${recipientIds.length !== 1 ? 's' : ''}`;
    }
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  // Stats
  const stats = {
    pending: messages.filter((m) => m.status === 'pending').length,
    sent: messages.filter((m) => m.status === 'sent').length,
    failed: messages.filter((m) => m.status === 'failed').length,
    cancelled: messages.filter((m) => m.status === 'cancelled').length,
  };

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Scheduled Messages
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              View and manage your scheduled messages
            </p>
          </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Kanban view"
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          <div className="text-sm text-gray-500">Sent</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
          <div className="text-sm text-gray-500">Cancelled</div>
        </div>
      </div>

      {/* Filters - Only show in list view */}
      {viewMode === 'list' && (
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'sent', 'failed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Kanban Board View */}
      {viewMode === 'kanban' && !loading && messages.length === 0 && (
        <div className="card p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No scheduled messages
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Schedule a message from the Compose page to see it here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/compose')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              Schedule a Message
            </button>
            <button
              onClick={() => navigate('/compose')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Go to Compose
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {viewMode === 'kanban' && !loading && messages.length > 0 && (
        <KanbanBoard
          messages={messages}
          templates={templates}
          contacts={contacts}
          getRecipientNames={getRecipientNames}
          onCancel={handleCancel}
          onDelete={handleDelete}
          cancellingId={cancellingId}
          deletingId={deletingId}
        />
      )}

      {/* Messages List */}
      {viewMode === 'list' && (
        <>
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="card p-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No scheduled messages
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {filter === 'all'
                  ? 'Schedule a message from the Compose page to see it here.'
                  : `No messages with status "${filter}".`}
              </p>
              {filter === 'all' && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/compose')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
                  >
                    <Send className="w-4 h-4" />
                    Schedule a Message
                  </button>
                  <button
                    onClick={() => navigate('/compose')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Go to Compose
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const template = templates.get(message.templateId);
                const isPending = message.status === 'pending';
                const scheduledDate = new Date(message.scheduledFor);
                const isPast = scheduledDate <= new Date();

                return (
                  <div
                    key={message.id}
                    className="card p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {template?.name || 'Unknown Template'}
                        </h3>
                        {getStatusBadge(message.status)}
                      </div>

                      <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{getRecipientNames(message.recipientIds)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(scheduledDate, 'PPpp')}
                            <span className="text-gray-400 ml-1">({message.timezone})</span>
                          </span>
                        </div>
                        {isPending && (
                          <div className={`flex items-center gap-2 ${isPast ? 'text-red-500' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            <Clock className="w-4 h-4" />
                            <span>
                              {isPast
                                ? 'Scheduled time has passed - will be sent soon'
                                : formatDistanceToNow(scheduledDate, { addSuffix: true })
                              }
                            </span>
                          </div>
                        )}
                        {message.errorMessage && (
                          <div className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            <span>{message.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <button
                          onClick={() => handleCancel(message.id)}
                          disabled={cancellingId === message.id}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className={`w-4 h-4 ${cancellingId === message.id ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                      {['cancelled', 'failed', 'sent'].includes(message.status) && (
                        <button
                          onClick={() => handleDelete(message.id)}
                          disabled={deletingId === message.id}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className={`w-4 h-4 ${deletingId === message.id ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

        {/* Loading for Kanban */}
        {viewMode === 'kanban' && loading && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        )}
      </div>
    </div>
  );
}

// Kanban Board Component
interface KanbanBoardProps {
  messages: ScheduledMessage[];
  templates: Map<string, Template>;
  contacts: Map<string, Contact>;
  getRecipientNames: (recipientIds: string[]) => string;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  cancellingId: string | null;
  deletingId: string | null;
}

const KANBAN_COLUMNS: { status: ScheduleStatus; title: string; color: string; bgColor: string }[] = [
  { status: 'pending', title: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { status: 'sent', title: 'Sent', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  { status: 'failed', title: 'Failed', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  { status: 'cancelled', title: 'Cancelled', color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-800' },
];

function KanbanBoard({
  messages,
  templates,
  contacts,
  getRecipientNames,
  onCancel,
  onDelete,
  cancellingId,
  deletingId,
}: KanbanBoardProps) {
  const getColumnMessages = (status: ScheduleStatus) =>
    messages.filter((m) => m.status === status);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((column) => {
        const columnMessages = getColumnMessages(column.status);

        return (
          <div
            key={column.status}
            className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
          >
            {/* Column Header */}
            <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${column.bgColor} rounded-t-xl`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${column.color}`}>
                  {column.title}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${column.bgColor} ${column.color}`}>
                  {columnMessages.length}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto">
              {columnMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No messages
                </div>
              ) : (
                columnMessages.map((message) => {
                  const template = templates.get(message.templateId);
                  const scheduledDate = new Date(message.scheduledFor);
                  const isPast = scheduledDate <= new Date();

                  return (
                    <div
                      key={message.id}
                      className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate flex-1">
                          {template?.name || 'Unknown Template'}
                        </h4>
                        {/* Actions */}
                        {column.status === 'pending' && (
                          <button
                            onClick={() => onCancel(message.id)}
                            disabled={cancellingId === message.id}
                            className="p-1 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className={`w-3 h-3 ${cancellingId === message.id ? 'animate-pulse' : ''}`} />
                          </button>
                        )}
                        {['cancelled', 'failed', 'sent'].includes(column.status) && (
                          <button
                            onClick={() => onDelete(message.id)}
                            disabled={deletingId === message.id}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className={`w-3 h-3 ${deletingId === message.id ? 'animate-pulse' : ''}`} />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Users className="w-3 h-3" />
                          <span className="truncate">{getRecipientNames(message.recipientIds)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{format(scheduledDate, 'MMM d, h:mm a')}</span>
                        </div>
                        {column.status === 'pending' && (
                          <div className={`flex items-center gap-1.5 text-xs ${isPast ? 'text-red-500' : 'text-yellow-600'}`}>
                            <Clock className="w-3 h-3" />
                            <span>
                              {isPast ? 'Overdue' : formatDistanceToNow(scheduledDate, { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        {message.errorMessage && (
                          <div className="flex items-center gap-1.5 text-xs text-red-500">
                            <AlertCircle className="w-3 h-3" />
                            <span className="truncate">{message.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
