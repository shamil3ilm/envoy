import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  FileText,
  Users,
  Send,
  Clock,
  History,
  Settings,
  Mail,
  UserPlus,
  FileEdit,
  Bell,
  Activity,
  Timer,
  Workflow,
  CheckSquare,
  StickyNote,
  Zap,
  DollarSign,
  Database,
  Loader2,
} from 'lucide-react';

interface Command {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  section: 'navigation' | 'actions' | 'recent' | 'search';
}

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'contact' | 'template' | 'task' | 'note' | 'snippet' | 'expense' | 'reminder' | 'document';
  href: string;
}

const TYPE_CONFIG: Record<SearchResult['type'], { label: string; color: string; icon: React.ReactNode }> = {
  contact: { label: 'Contact', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', icon: <Users className="w-4 h-4" /> },
  template: { label: 'Template', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400', icon: <FileText className="w-4 h-4" /> },
  task: { label: 'Task', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', icon: <CheckSquare className="w-4 h-4" /> },
  note: { label: 'Note', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400', icon: <StickyNote className="w-4 h-4" /> },
  snippet: { label: 'Snippet', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: <Zap className="w-4 h-4" /> },
  expense: { label: 'Expense', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: <DollarSign className="w-4 h-4" /> },
  reminder: { label: 'Reminder', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400', icon: <Bell className="w-4 h-4" /> },
  document: { label: 'Document', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', icon: <FileEdit className="w-4 h-4" /> },
};

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const commands: Command[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      action: () => { navigate('/dashboard'); onClose(); },
      keywords: ['home', 'overview'],
      section: 'navigation',
    },
    {
      id: 'nav-templates',
      title: 'Go to Templates',
      icon: <FileText className="w-4 h-4" />,
      action: () => { navigate('/templates'); onClose(); },
      keywords: ['message', 'email'],
      section: 'navigation',
    },
    {
      id: 'nav-contacts',
      title: 'Go to Contacts',
      icon: <Users className="w-4 h-4" />,
      action: () => { navigate('/contacts'); onClose(); },
      keywords: ['people', 'recipients'],
      section: 'navigation',
    },
    {
      id: 'nav-compose',
      title: 'Go to Compose',
      icon: <Send className="w-4 h-4" />,
      action: () => { navigate('/compose'); onClose(); },
      keywords: ['send', 'write', 'new'],
      section: 'navigation',
    },
    {
      id: 'nav-scheduled',
      title: 'Go to Scheduled',
      icon: <Clock className="w-4 h-4" />,
      action: () => { navigate('/scheduled'); onClose(); },
      keywords: ['planned', 'queue'],
      section: 'navigation',
    },
    {
      id: 'nav-history',
      title: 'Go to History',
      icon: <History className="w-4 h-4" />,
      action: () => { navigate('/history'); onClose(); },
      keywords: ['sent', 'log', 'audit'],
      section: 'navigation',
    },
    {
      id: 'nav-activity',
      title: 'Go to Activity Log',
      icon: <Activity className="w-4 h-4" />,
      action: () => { navigate('/activity'); onClose(); },
      keywords: ['events', 'actions'],
      section: 'navigation',
    },
    {
      id: 'nav-focus',
      title: 'Go to Focus Timer',
      icon: <Timer className="w-4 h-4" />,
      action: () => { navigate('/focus'); onClose(); },
      keywords: ['pomodoro', 'timer', 'focus', 'productivity'],
      section: 'navigation',
    },
    {
      id: 'nav-automations',
      title: 'Go to Automations',
      icon: <Workflow className="w-4 h-4" />,
      action: () => { navigate('/automations'); onClose(); },
      keywords: ['rules', 'automation', 'workflow', 'if then'],
      section: 'navigation',
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => { navigate('/settings'); onClose(); },
      keywords: ['preferences', 'config'],
      section: 'navigation',
    },
    // Actions
    {
      id: 'action-new-template',
      title: 'Create New Template',
      description: 'Create a new message template',
      icon: <FileEdit className="w-4 h-4" />,
      action: () => { navigate('/templates?new=true'); onClose(); },
      keywords: ['add', 'new'],
      section: 'actions',
    },
    {
      id: 'action-new-contact',
      title: 'Add New Contact',
      description: 'Add a new contact to your list',
      icon: <UserPlus className="w-4 h-4" />,
      action: () => { navigate('/contacts?new=true'); onClose(); },
      keywords: ['add', 'create', 'person'],
      section: 'actions',
    },
    {
      id: 'action-compose',
      title: 'Compose Message',
      description: 'Start composing a new message',
      icon: <Mail className="w-4 h-4" />,
      action: () => { navigate('/compose'); onClose(); },
      keywords: ['send', 'email', 'write'],
      section: 'actions',
    },
    {
      id: 'action-schedule',
      title: 'Schedule Message',
      description: 'Schedule a message for later',
      icon: <Clock className="w-4 h-4" />,
      action: () => { navigate('/compose?schedule=true'); onClose(); },
      keywords: ['plan', 'later', 'future'],
      section: 'actions',
    },
    {
      id: 'action-reminder',
      title: 'Create Reminder',
      description: 'Set a reminder for yourself',
      icon: <Bell className="w-4 h-4" />,
      action: () => { navigate('/dashboard?reminder=true'); onClose(); },
      keywords: ['alert', 'notify', 'todo'],
      section: 'actions',
    },
    {
      id: 'action-backup-export',
      title: 'Export All Data',
      description: 'Save a JSON backup of every entity',
      icon: <FileText className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.backup.export();
          if (result.success) {
            const total = Object.values(result.counts).reduce(
              (sum, n) => sum + Number(n),
              0
            );
            // eslint-disable-next-line no-console
            console.info(`Exported ${total} records to ${result.path}`);
          } else if (!result.cancelled && result.error) {
            // eslint-disable-next-line no-console
            console.error('Export failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Backup export failed', err);
        }
      },
      keywords: ['backup', 'export', 'save', 'download', 'json'],
      section: 'actions',
    },
    {
      id: 'action-backup-inspect',
      title: 'Inspect Backup File',
      description: 'Preview a backup file without applying it',
      icon: <FileText className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.backup.inspect();
          if (result.success) {
            // eslint-disable-next-line no-console
            console.info(
              `Backup at ${result.path}: ${result.summary.totalRecords} records exported ${result.summary.exportedAt}`,
              result.summary.counts
            );
          } else if (!result.cancelled && result.error) {
            // eslint-disable-next-line no-console
            console.error('Inspect failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Backup inspect failed', err);
        }
      },
      keywords: ['backup', 'inspect', 'preview', 'validate', 'check'],
      section: 'actions',
    },
    {
      id: 'action-backup-restore',
      title: 'Restore From Backup',
      description: 'Merge a JSON backup into the current database',
      icon: <FileText className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.backup.restore();
          if (result.success) {
            // eslint-disable-next-line no-console
            console.info(
              `Restored ${result.totalApplied} records. Safety snapshot: ${result.preRestorePath ?? '(none)'}`
            );
          } else if (!result.cancelled && result.error) {
            // eslint-disable-next-line no-console
            console.error('Restore failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Backup restore failed', err);
        }
      },
      keywords: ['backup', 'restore', 'import', 'merge', 'recover'],
      section: 'actions',
    },
    {
      id: 'action-backup-auto-enable',
      title: 'Enable Auto-Backup (Daily)',
      description: 'Write a JSON backup once per day; keep the newest 7',
      icon: <Clock className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.backup.autoSet({
            enabled: true,
            intervalHours: 24,
            keepCount: 7,
          });
          if (result.success) {
            // eslint-disable-next-line no-console
            console.info('Auto-backup enabled', result.autoBackup);
          } else {
            // eslint-disable-next-line no-console
            console.error('Enable auto-backup failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Enable auto-backup failed', err);
        }
      },
      keywords: ['backup', 'auto', 'schedule', 'daily', 'enable'],
      section: 'actions',
    },
    {
      id: 'action-backup-auto-disable',
      title: 'Disable Auto-Backup',
      description: 'Stop the scheduled backup job',
      icon: <Clock className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.backup.autoSet({ enabled: false });
          if (result.success) {
            // eslint-disable-next-line no-console
            console.info('Auto-backup disabled');
          } else {
            // eslint-disable-next-line no-console
            console.error('Disable auto-backup failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Disable auto-backup failed', err);
        }
      },
      keywords: ['backup', 'auto', 'schedule', 'disable', 'stop'],
      section: 'actions',
    },
    {
      id: 'action-backup-restore-latest-auto',
      title: 'Restore Latest Auto-Backup',
      description: 'One-click recovery from the newest scheduled backup',
      icon: <Clock className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.backup.restoreLatestAuto();
          if (result.success) {
            // eslint-disable-next-line no-console
            console.info(
              `Restored ${result.totalApplied} records from ${result.source}. Safety snapshot: ${result.preRestorePath ?? '(none)'}`
            );
          } else if (!result.cancelled && result.error) {
            // eslint-disable-next-line no-console
            console.error('Restore latest failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Restore latest auto-backup failed', err);
        }
      },
      keywords: ['backup', 'restore', 'latest', 'auto', 'recover', 'undo'],
      section: 'actions',
    },
    {
      id: 'action-diagnostics-check-db',
      title: 'Check Database Integrity',
      description: 'Run PRAGMA integrity_check on the SQLite file',
      icon: <Database className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.diagnostics.checkDb();
          if (result.ok) {
            // eslint-disable-next-line no-console
            console.info('Database integrity OK');
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              'Database integrity issues:',
              result.error ?? result.issues.join('; ')
            );
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Integrity check failed', err);
        }
      },
      keywords: ['diagnostics', 'integrity', 'check', 'database', 'health', 'sqlite'],
      section: 'actions',
    },
    {
      id: 'action-diagnostics-open-backups-folder',
      title: 'Open Backups Folder',
      description: 'Reveal userData/backups in the OS file manager',
      icon: <Database className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.diagnostics.openBackupsFolder();
          if (!result.success) {
            // eslint-disable-next-line no-console
            console.error('Open backups folder failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Open backups folder failed', err);
        }
      },
      keywords: ['open', 'reveal', 'backups', 'folder', 'files', 'explorer', 'finder'],
      section: 'actions',
    },
    {
      id: 'action-diagnostics-stats',
      title: 'Show Storage Stats',
      description: 'Log DB size, backup count, and log size',
      icon: <Database className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const s = await window.envoy.diagnostics.stats();
          const fmt = (bytes: number | null | undefined) =>
            bytes == null ? 'n/a' : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
          // eslint-disable-next-line no-console
          console.info('Envoy storage stats', {
            userData: s.userDataPath,
            database: `${s.databaseFile ?? '(none)'} — ${fmt(s.databaseBytes)}`,
            backups: `${s.backupCount} file(s) — ${fmt(s.backupsBytes)} in ${s.backupsPath}`,
            logs: `${fmt(s.logsBytes)} in ${s.logsPath}`,
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Storage stats failed', err);
        }
      },
      keywords: ['storage', 'stats', 'size', 'diagnostics', 'usage'],
      section: 'actions',
    },
    {
      id: 'action-diagnostics-vacuum',
      title: 'Compact Database (VACUUM)',
      description: 'Reclaim unused space from the SQLite file',
      icon: <Database className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.diagnostics.vacuum();
          if (result.success) {
            const fmt = (b: number | undefined) =>
              b == null ? '?' : `${(b / (1024 * 1024)).toFixed(2)} MB`;
            // eslint-disable-next-line no-console
            console.info(
              `VACUUM freed ${fmt(result.freedBytes)} (${fmt(result.sizeBefore)} → ${fmt(result.sizeAfter)})`
            );
          } else {
            // eslint-disable-next-line no-console
            console.error('VACUUM failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('VACUUM failed', err);
        }
      },
      keywords: ['vacuum', 'compact', 'shrink', 'reclaim', 'space', 'diagnostics'],
      section: 'actions',
    },
    {
      id: 'action-diagnostics-debug-info',
      title: 'Copy Debug Info',
      description: 'Copy a support-ready diagnostic bundle to the clipboard',
      icon: <Database className="w-4 h-4" />,
      action: async () => {
        onClose();
        try {
          const result = await window.envoy.diagnostics.debugInfo();
          if (result.success && result.text) {
            try {
              await navigator.clipboard.writeText(result.text);
              // eslint-disable-next-line no-console
              console.info('Debug info copied to clipboard');
            } catch {
              // eslint-disable-next-line no-console
              console.info(result.text);
            }
          } else {
            // eslint-disable-next-line no-console
            console.error('Debug info collection failed:', result.error);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Debug info collection failed', err);
        }
      },
      keywords: ['debug', 'support', 'copy', 'info', 'diagnostics', 'about'],
      section: 'actions',
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some((k) => k.includes(searchLower))
    );
  });

  const groupedCommands = {
    actions: filteredCommands.filter((c) => c.section === 'actions'),
    navigation: filteredCommands.filter((c) => c.section === 'navigation'),
  };

  // Convert search results to commands for unified keyboard navigation
  const searchCommands: Command[] = searchResults.map((r) => ({
    id: `search-${r.type}-${r.id}`,
    title: r.title,
    description: r.subtitle,
    icon: TYPE_CONFIG[r.type].icon,
    action: () => { navigate(r.href); onClose(); },
    section: 'search' as const,
    keywords: [],
  }));

  const allFiltered = [...groupedCommands.actions, ...groupedCommands.navigation, ...searchCommands];

  // Debounced global search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (search.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const q = search;
        const results: SearchResult[] = [];

        const [contacts, tasks, notes, snippets, templates, expenses, reminders, documents] = await Promise.all([
          window.envoy.contacts.list({ search: q }).catch(() => []),
          window.envoy.tasks.list({ search: q }).catch(() => []),
          window.envoy.notes.list({ search: q }).catch(() => []),
          window.envoy.snippets.list({ search: q }).catch(() => []),
          window.envoy.templates.list().catch(() => []),
          window.envoy.expenses.list({ search: q }).catch(() => []),
          window.envoy.reminders.list().catch(() => []),
          window.envoy.richDocuments.list().catch(() => []),
        ]);

        // Contacts
        contacts.slice(0, 5).forEach((c: any) => {
          results.push({
            id: c.id,
            title: c.name,
            subtitle: c.email || c.company || undefined,
            type: 'contact',
            href: `/contacts?highlight=${c.id}`,
          });
        });

        // Tasks
        tasks.slice(0, 5).forEach((t: any) => {
          results.push({
            id: t.id,
            title: t.title,
            subtitle: t.status ? `Status: ${t.status}` : undefined,
            type: 'task',
            href: '/tasks',
          });
        });

        // Notes
        notes.slice(0, 5).forEach((n: any) => {
          results.push({
            id: n.id,
            title: n.title || 'Untitled note',
            subtitle: undefined,
            type: 'note',
            href: '/notes',
          });
        });

        // Snippets
        snippets.slice(0, 5).forEach((s: any) => {
          results.push({
            id: s.id,
            title: s.name,
            subtitle: s.shortcut ? `#${s.shortcut}` : undefined,
            type: 'snippet',
            href: '/snippets',
          });
        });

        // Templates - client-side filter since templates.list doesn't support search param
        const qLower = q.toLowerCase();
        templates
          .filter((t: any) =>
            t.name?.toLowerCase().includes(qLower) ||
            t.subject?.toLowerCase().includes(qLower)
          )
          .slice(0, 5)
          .forEach((t: any) => {
            results.push({
              id: t.id,
              title: t.name,
              subtitle: t.subject || t.channel || undefined,
              type: 'template',
              href: '/templates',
            });
          });

        // Expenses
        expenses.slice(0, 5).forEach((e: any) => {
          results.push({
            id: e.id,
            title: e.description || 'Expense',
            subtitle: e.amount ? `${e.currency || '$'}${e.amount}` : undefined,
            type: 'expense',
            href: '/expenses',
          });
        });

        // Reminders — client-side filter (list doesn't accept a search param)
        reminders
          .filter((r: any) =>
            r.title?.toLowerCase().includes(qLower) ||
            r.description?.toLowerCase().includes(qLower)
          )
          .slice(0, 5)
          .forEach((r: any) => {
            results.push({
              id: r.id,
              title: r.title,
              subtitle: r.dueAt ? new Date(r.dueAt).toLocaleString() : undefined,
              type: 'reminder',
              href: '/reminders',
            });
          });

        // Rich documents — client-side filter
        documents
          .filter((d: any) =>
            d.title?.toLowerCase().includes(qLower) ||
            d.content?.toLowerCase().includes(qLower)
          )
          .slice(0, 5)
          .forEach((d: any) => {
            results.push({
              id: d.id,
              title: d.title || 'Untitled document',
              subtitle: d.isTemplate ? 'Template' : undefined,
              type: 'document',
              href: '/documents',
            });
          });

        setSearchResults(results);
      } catch (err) {
        console.error('Global search error:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
      setSearchResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, searchResults]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, allFiltered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allFiltered[selectedIndex]) {
            allFiltered[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, allFiltered, selectedIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
        <div className="relative w-full max-w-xl transform rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base"
            />
            {searchLoading && (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            )}
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {allFiltered.length === 0 && !searchLoading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No results found for "{search}"
              </div>
            ) : (
              <>
                {/* Actions Section */}
                {groupedCommands.actions.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </div>
                    {groupedCommands.actions.map((cmd) => {
                      const idx = currentIndex++;
                      return (
                        <button
                          key={cmd.id}
                          data-index={idx}
                          onClick={cmd.action}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedIndex === idx
                              ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md ${
                            selectedIndex === idx
                              ? 'bg-primary-100 dark:bg-gray-600 text-primary-600 dark:text-primary-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{cmd.title}</div>
                            {cmd.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Navigation Section */}
                {groupedCommands.navigation.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Navigation
                    </div>
                    {groupedCommands.navigation.map((cmd) => {
                      const idx = currentIndex++;
                      return (
                        <button
                          key={cmd.id}
                          data-index={idx}
                          onClick={cmd.action}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedIndex === idx
                              ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md ${
                            selectedIndex === idx
                              ? 'bg-primary-100 dark:bg-gray-600 text-primary-600 dark:text-primary-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {cmd.icon}
                          </div>
                          <div className="font-medium">{cmd.title}</div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search Results Section */}
                {searchResults.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Search Results
                    </div>
                    {searchResults.map((result) => {
                      const idx = currentIndex++;
                      const config = TYPE_CONFIG[result.type];
                      return (
                        <button
                          key={`search-${result.type}-${result.id}`}
                          data-index={idx}
                          onClick={() => { navigate(result.href); onClose(); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedIndex === idx
                              ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md ${
                            selectedIndex === idx
                              ? 'bg-primary-100 dark:bg-gray-600 text-primary-600 dark:text-primary-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{result.title}</span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${config.color}`}>
                                {config.label}
                              </span>
                            </div>
                            {result.subtitle && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Loading indicator for search */}
                {searchLoading && searchResults.length === 0 && search.length >= 2 && (
                  <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <span className="text-sm">Searching...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
              to select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
