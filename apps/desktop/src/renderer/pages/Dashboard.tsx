import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Send,
  FileText,
  Users,
  Clock,
  ArrowRight,
  Calendar,
  Bell,
  ChevronRight,
  Sparkles,
  Settings,
  Eye,
  EyeOff,
  CheckSquare,
  Flag,
  GripVertical,
  RotateCcw,
  Columns2,
  Columns3,
  RectangleHorizontal,
} from 'lucide-react';
import type { UserActivityLog, ScheduledMessage, Task, CalendarEvent, DashboardWidgetId, WidgetSpan } from '@shared/types';
import { USER_PROFILES, DASHBOARD_WIDGET_IDS, DEFAULT_WIDGET_SPANS } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useUserProfiles } from '../hooks/useUserProfiles';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';
import { ICON_MAP } from '../utils/iconMap';
import ReminderPanel from '../components/ReminderPanel';

interface Stats {
  totalTemplates: number;
  totalContacts: number;
  sentToday: number;
  pendingScheduled: number;
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  let greeting = '';
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good evening';
  else greeting = 'Good night';

  if (name && name.trim()) {
    return `${greeting}, ${name.trim()}!`;
  }
  return `${greeting}!`;
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { enabledProfiles, hasAnyProfile } = useUserProfiles();
  const [stats, setStats] = useState<Stats>({
    totalTemplates: 0,
    totalContacts: 0,
    sentToday: 0,
    pendingScheduled: 0,
  });
  const [recentActivity, setRecentActivity] = useState<UserActivityLog[]>([]);
  const [upcomingScheduled, setUpcomingScheduled] = useState<ScheduledMessage[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomizeMenu, setShowCustomizeMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Drag-and-drop state
  const [draggedWidget, setDraggedWidget] = useState<DashboardWidgetId | null>(null);
  const [dropTarget, setDropTarget] = useState<DashboardWidgetId | null>(null);
  const dragCounter = useRef(0);

  // Live clock - update every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { fmtTime, fmtDate, fmtShortDate, fmtShortDateTime } = useDateTimeFormat();

  const widgetOrder: DashboardWidgetId[] = useMemo(() => {
    const saved = settings.dashboard?.widgetOrder;
    if (!saved) return [...DASHBOARD_WIDGET_IDS];

    // Migrate old compound widget IDs to new individual ones
    const migrationMap: Record<string, DashboardWidgetId[]> = {
      quickLinksUpcoming: ['quickLinks', 'upcoming'],
      tasksEventsReminders: ['tasks', 'events', 'reminders'],
    };
    const validIds = new Set<string>(DASHBOARD_WIDGET_IDS);
    const migrated: DashboardWidgetId[] = [];

    for (const id of saved) {
      if (migrationMap[id]) {
        migrated.push(...migrationMap[id]);
      } else if (validIds.has(id)) {
        migrated.push(id);
      }
    }

    // Add any new widgets that weren't in the saved order
    for (const id of DASHBOARD_WIDGET_IDS) {
      if (!migrated.includes(id)) {
        migrated.push(id);
      }
    }

    return migrated;
  }, [settings.dashboard?.widgetOrder]);

  const toggleSection = async (section: 'showQuickLinks' | 'showUpcoming' | 'showRecentActivity' | 'showUpcomingTasks' | 'showUpcomingEvents' | 'showReminders') => {
    const newDashboard = {
      ...settings.dashboard,
      [section]: !settings.dashboard?.[section],
    };
    try {
      await updateSettings({ dashboard: newDashboard });
    } catch (error) {
      console.error('Failed to save dashboard settings:', error);
    }
  };

  const resetWidgetOrder = async () => {
    try {
      await updateSettings({
        dashboard: { ...settings.dashboard, widgetOrder: [...DASHBOARD_WIDGET_IDS] },
      });
      setShowCustomizeMenu(false);
    } catch (error) {
      console.error('Failed to reset widget order:', error);
    }
  };

  // Drag handlers
  const handleDragStart = useCallback((widgetId: DashboardWidgetId) => (e: React.DragEvent) => {
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedWidget(null);
    setDropTarget(null);
    dragCounter.current = 0;
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragEnter = useCallback((widgetId: DashboardWidgetId) => (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDropTarget(widgetId);
  }, []);

  const handleDragLeave = useCallback(() => (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDropTarget(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetId: DashboardWidgetId) => async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    const sourceId = e.dataTransfer.getData('text/plain') as DashboardWidgetId;
    if (!sourceId || sourceId === targetId) {
      setDraggedWidget(null);
      setDropTarget(null);
      return;
    }

    const newOrder = [...widgetOrder];
    const sourceIdx = newOrder.indexOf(sourceId);
    const targetIdx = newOrder.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    newOrder.splice(sourceIdx, 1);
    newOrder.splice(targetIdx, 0, sourceId);

    try {
      await updateSettings({
        dashboard: { ...settings.dashboard, widgetOrder: newOrder },
      });
    } catch (error) {
      console.error('Failed to save widget order:', error);
    }

    setDraggedWidget(null);
    setDropTarget(null);
  }, [widgetOrder, settings.dashboard, updateSettings]);

  useEffect(() => {
    async function loadData() {
      try {
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [templates, contacts, scheduledMessages, activityResult, allTasks, calendarEvents] = await Promise.all([
          window.envoy.templates.list(),
          window.envoy.contacts.list(),
          window.envoy.schedule.list({ status: 'pending' }),
          window.envoy.activity.list({ limit: 6 }),
          window.envoy.tasks.list(),
          window.envoy.calendar.list({
            fromDate: now.toISOString(),
            toDate: weekFromNow.toISOString(),
          }),
        ]);

        const today = now.toISOString().split('T')[0];
        const todayLogs = await window.envoy.audit.list({
          fromDate: today,
          status: 'sent',
        });

        setStats({
          totalTemplates: templates.length,
          totalContacts: contacts.length,
          sentToday: todayLogs.length,
          pendingScheduled: scheduledMessages.length,
        });
        setRecentActivity(activityResult.logs);
        setUpcomingScheduled(scheduledMessages.slice(0, 3));

        setUpcomingTasks(
          allTasks
            .filter((t: Task) => t.status !== 'done' && t.dueDate)
            .sort((a: Task, b: Task) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 5)
        );

        setUpcomingEvents(
          calendarEvents
            .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 5)
        );
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // --- Widget render functions ---

  const renderStats = () => (
    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
      <Link to="/templates" className="hover:text-gray-900 dark:hover:text-white transition-colors">
        <span className="font-semibold text-gray-900 dark:text-white">{loading ? '—' : stats.totalTemplates}</span> templates
      </Link>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <Link to="/contacts" className="hover:text-gray-900 dark:hover:text-white transition-colors">
        <span className="font-semibold text-gray-900 dark:text-white">{loading ? '—' : stats.totalContacts}</span> contacts
      </Link>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <Link to="/history" className="hover:text-gray-900 dark:hover:text-white transition-colors">
        <span className="font-semibold text-gray-900 dark:text-white">{loading ? '—' : stats.sentToday}</span> sent today
      </Link>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <Link to="/scheduled" className="hover:text-gray-900 dark:hover:text-white transition-colors">
        <span className="font-semibold text-gray-900 dark:text-white">{loading ? '—' : stats.pendingScheduled}</span> scheduled
      </Link>
    </div>
  );

  const renderMainAction = () => (
    <button
      onClick={() => navigate('/compose')}
      className="w-full p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-primary-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-gray-600 transition-all group text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center shadow-sm">
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white text-lg">
              Compose a message
            </div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">
              Send an email or schedule for later
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
      </div>
    </button>
  );

  const renderForYou = () => {
    if (!hasAnyProfile) return null;
    return (
      <div>
        <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          For you
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {enabledProfiles.map((profileId) => {
            const profile = USER_PROFILES[profileId];
            if (!profile) return null;
            const IconComponent = ICON_MAP[profile.icon];
            return (
              <div
                key={profileId}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  {IconComponent && (
                    <IconComponent className="w-4 h-4" style={{ color: profile.color }} />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {profile.label}
                  </span>
                </div>
                <div className="space-y-1">
                  <Link
                    to="/expenses"
                    className="block text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {Object.values(profile.expenseCategories)[0]?.label || 'Track expenses'}
                  </Link>
                  <Link
                    to="/tasks"
                    className="block text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {profile.taskTags[0] ? `${profile.taskTags[0].charAt(0).toUpperCase() + profile.taskTags[0].slice(1)} tasks` : 'View tasks'}
                  </Link>
                  <Link
                    to="/templates"
                    className="block text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {profile.templateSuggestions[0] || 'Create template'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQuickLinks = () => {
    if (settings.dashboard?.showQuickLinks === false) return null;
    return (
      <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-5 border border-gray-100 dark:border-gray-800 h-full">
        <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
          Quick links
        </h2>
        <div className="space-y-1">
          <Link to="/templates?new=true" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors group">
            <FileText className="w-5 h-5 text-purple-500" />
            <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Create a template</span>
          </Link>
          <Link to="/contacts?new=true" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors group">
            <Users className="w-5 h-5 text-green-500" />
            <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Add a contact</span>
          </Link>
          <Link to="/snippets" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors group">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Manage snippets</span>
          </Link>
          <Link to="/scheduled" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors group">
            <Calendar className="w-5 h-5 text-orange-500" />
            <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">View scheduled</span>
          </Link>
        </div>
      </div>
    );
  };

  const renderUpcoming = () => {
    if (settings.dashboard?.showUpcoming === false) return null;
    return (
      <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-5 border border-gray-100 dark:border-gray-800 h-full">
        <div className="flex items-center justify-between mb-4 pr-8">
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Upcoming</h2>
          {upcomingScheduled.length > 0 && (
            <Link to="/scheduled" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">View all</Link>
          )}
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-4">Loading...</div>
        ) : upcomingScheduled.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No scheduled messages</p>
            <button onClick={() => navigate('/compose?schedule=true')} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2">
              Schedule one now
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingScheduled.map((msg) => (
              <div key={msg.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-900 dark:text-white font-medium">{fmtShortDateTime(new Date(msg.scheduledFor))}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {msg.recipientIds.length} recipient{msg.recipientIds.length !== 1 ? 's' : ''} · {msg.channel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTasks = () => {
    if (settings.dashboard?.showUpcomingTasks === false) return null;
    return (
      <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-5 border border-gray-100 dark:border-gray-800 h-full">
        <div className="flex items-center justify-between mb-4 pr-8">
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Upcoming Tasks</h2>
          <Link to="/tasks" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">View all</Link>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-4">Loading...</div>
        ) : upcomingTasks.length === 0 ? (
          <div className="py-6 text-center">
            <CheckSquare className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming tasks</p>
            <button onClick={() => navigate('/tasks?new=true')} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2">
              Add a task
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Flag className={`w-3 h-3 flex-shrink-0 ${task.priority === 'high' ? 'text-red-500' : task.priority === 'medium' ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className="text-gray-900 dark:text-white font-medium truncate">{task.title}</span>
                </div>
                {task.dueDate && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtShortDate(new Date(task.dueDate))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEvents = () => {
    if (settings.dashboard?.showUpcomingEvents === false) return null;
    return (
      <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-5 border border-gray-100 dark:border-gray-800 h-full">
        <div className="flex items-center justify-between mb-4 pr-8">
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Upcoming Events</h2>
          <Link to="/calendar" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">View all</Link>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-4">Loading...</div>
        ) : upcomingEvents.length === 0 ? (
          <div className="py-6 text-center">
            <Calendar className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events</p>
            <button onClick={() => navigate('/calendar?new=true')} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2">
              Add an event
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: event.color || '#3b82f6' }} />
                  <span className="text-gray-900 dark:text-white font-medium truncate">{event.title}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {event.allDay ? `${fmtShortDate(new Date(event.startDate))} (All day)` : fmtShortDateTime(new Date(event.startDate))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderReminders = () => {
    if (settings.dashboard?.showReminders === false) return null;
    return (
      <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-5 border border-gray-100 dark:border-gray-800 h-full">
        <div className="flex items-center justify-between mb-4 pr-8">
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reminders</h2>
          <Link to="/reminders" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">View all</Link>
        </div>
        <ReminderPanel compact maxItems={5} />
      </div>
    );
  };

  const renderRecentActivity = () => {
    if (settings.dashboard?.showRecentActivity === false) return null;
    return (
      <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-5 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4 pr-8">
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Recent activity
          </h2>
          <Link
            to="/activity"
            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 py-4">Loading...</div>
        ) : recentActivity.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No recent activity
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Your activity will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 py-2.5 text-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300 flex-1">
                  {activity.description}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                  {formatTimeAgo(activity.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Widget map
  const widgetRenderers: Record<DashboardWidgetId, () => React.ReactNode> = {
    stats: renderStats,
    mainAction: renderMainAction,
    forYou: renderForYou,
    quickLinks: renderQuickLinks,
    upcoming: renderUpcoming,
    tasks: renderTasks,
    events: renderEvents,
    reminders: renderReminders,
    recentActivity: renderRecentActivity,
  };

  const widgetLabels: Record<DashboardWidgetId, string> = {
    stats: 'Stats',
    mainAction: 'Compose Action',
    forYou: 'For You',
    quickLinks: 'Quick Links',
    upcoming: 'Upcoming',
    tasks: 'Tasks',
    events: 'Events',
    reminders: 'Reminders',
    recentActivity: 'Recent Activity',
  };

  // Widget column spans from settings (with defaults)
  const widgetSpans = useMemo(() => {
    const saved = settings.dashboard?.widgetSpans || {};
    const spans: Record<string, WidgetSpan> = {};
    for (const id of DASHBOARD_WIDGET_IDS) {
      spans[id] = saved[id] || DEFAULT_WIDGET_SPANS[id] || 1;
    }
    return spans;
  }, [settings.dashboard?.widgetSpans]);

  const cycleWidgetSpan = useCallback(async (widgetId: DashboardWidgetId) => {
    const current = widgetSpans[widgetId] || 1;
    const next: WidgetSpan = current === 1 ? 2 : current === 2 ? 3 : 1;
    const newSpans = { ...settings.dashboard?.widgetSpans, [widgetId]: next };
    try {
      await updateSettings({ dashboard: { ...settings.dashboard, widgetSpans: newSpans } });
    } catch (error) {
      console.error('Failed to update widget span:', error);
    }
  }, [widgetSpans, settings.dashboard, updateSettings]);

  const spanClassMap: Record<WidgetSpan, string> = {
    1: '',
    2: 'md:col-span-2 xl:col-span-2',
    3: 'md:col-span-2 xl:col-span-3',
  };

  const spanIcons: Record<WidgetSpan, typeof RectangleHorizontal> = {
    1: RectangleHorizontal,
    2: Columns2,
    3: Columns3,
  };

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Simple Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {getGreeting(settings.profile?.showNameInGreeting ? settings.profile?.name : undefined)}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {fmtDate(currentTime)}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCustomizeMenu(!showCustomizeMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Customize dashboard"
            >
              <Settings className="w-5 h-5" />
            </button>
            {showCustomizeMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCustomizeMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-1.5">
                      Show sections
                    </div>
                    <button
                      onClick={() => toggleSection('showQuickLinks')}
                      className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {settings.dashboard?.showQuickLinks !== false ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      Quick Links
                    </button>
                    <button
                      onClick={() => toggleSection('showUpcoming')}
                      className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {settings.dashboard?.showUpcoming !== false ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      Upcoming
                    </button>
                    <button
                      onClick={() => toggleSection('showRecentActivity')}
                      className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {settings.dashboard?.showRecentActivity !== false ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      Recent Activity
                    </button>
                    <button
                      onClick={() => toggleSection('showUpcomingTasks')}
                      className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {settings.dashboard?.showUpcomingTasks !== false ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      Upcoming Tasks
                    </button>
                    <button
                      onClick={() => toggleSection('showUpcomingEvents')}
                      className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {settings.dashboard?.showUpcomingEvents !== false ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      Upcoming Events
                    </button>
                    <button
                      onClick={() => toggleSection('showReminders')}
                      className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      {settings.dashboard?.showReminders !== false ? (
                        <Eye className="w-4 h-4 text-primary-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      Reminders
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                      <button
                        onClick={resetWidgetOrder}
                        className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 text-gray-400" />
                        Reset widget order
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {widgetOrder.map((widgetId) => {
          const renderer = widgetRenderers[widgetId];
          if (!renderer) return null;
          const content = renderer();
          if (!content) return null;

          const isDragging = draggedWidget === widgetId;
          const isOver = dropTarget === widgetId && draggedWidget !== widgetId;
          const span = (widgetSpans[widgetId] || 1) as WidgetSpan;
          const SpanIcon = spanIcons[span];
          const nextSpan: WidgetSpan = span === 1 ? 2 : span === 2 ? 3 : 1;

          return (
            <div
              key={widgetId}
              draggable
              onDragStart={handleDragStart(widgetId)}
              onDragEnd={handleDragEnd}
              onDragEnter={handleDragEnter(widgetId)}
              onDragLeave={handleDragLeave()}
              onDragOver={handleDragOver}
              onDrop={handleDrop(widgetId)}
              className={`group/widget relative transition-all duration-200 ${
                spanClassMap[span]
              } ${isDragging ? 'opacity-50' : ''} ${isOver ? 'ring-2 ring-primary-400 ring-offset-2 dark:ring-offset-gray-900 rounded-xl' : ''}`}
            >
              {/* Drag handle */}
              <div
                className="absolute -left-6 top-4 opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
                title={`Drag to reorder: ${widgetLabels[widgetId]}`}
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
              {/* Resize button */}
              <button
                onClick={(e) => { e.stopPropagation(); cycleWidgetSpan(widgetId); }}
                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover/widget:opacity-100 transition-opacity bg-white/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
                title={`Resize to ${nextSpan} column${nextSpan > 1 ? 's' : ''}`}
              >
                <SpanIcon className="w-3.5 h-3.5" />
              </button>
              {content}
            </div>
          );
        })}
      </div>

      {/* Date & Time Footer */}
      <div className="px-4 sm:px-6 md:px-8 py-4 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {fmtDate(currentTime)}
          <span className="mx-2">·</span>
          {fmtTime(currentTime)}
        </p>
      </div>
    </div>
  );
}
