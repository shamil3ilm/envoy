import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Send,
  Clock,
  History,
  Settings,
  Activity,
  Sun,
  Moon,
  Monitor,
  Search,
  Command,
  ChevronDown,
  Zap,
  Calendar,
  CheckSquare,
  StickyNote,
  Calculator,
  DollarSign,
  FileUp,
  Bell,
  Timer,
  Workflow,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import CommandPalette from '../CommandPalette';
import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface CustomGroup {
  id: string;
  name: string;
  items: string[]; // hrefs
  isOpen: boolean;
}

// All available nav items for reference
const allNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
  { name: 'Compose', href: '/compose', icon: Send, description: 'Send messages' },
  { name: 'Templates', href: '/templates', icon: FileText, description: 'Message templates' },
  { name: 'Documents', href: '/documents', icon: FileUp, description: 'Documents & editor' },
  { name: 'Snippets', href: '/snippets', icon: Zap, description: 'Reusable text blocks' },
  { name: 'Contacts', href: '/contacts', icon: Users, description: 'Manage recipients' },
  { name: 'Scheduled', href: '/scheduled', icon: Clock, description: 'Pending messages' },
  { name: 'History', href: '/history', icon: History, description: 'Sent messages' },
  { name: 'Activity Log', href: '/activity', icon: Activity, description: 'All events' },
  { name: 'Calendar', href: '/calendar', icon: Calendar, description: 'Events & schedule' },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, description: 'Kanban board' },
  { name: 'Notes', href: '/notes', icon: StickyNote, description: 'Quick notes' },
  { name: 'Expenses', href: '/expenses', icon: DollarSign, description: 'Track spending' },
  { name: 'Calculator', href: '/calculator', icon: Calculator, description: 'Quick calculations' },
  { name: 'Reminders', href: '/reminders', icon: Bell, description: 'Manage reminders' },
  { name: 'Focus Timer', href: '/focus', icon: Timer, description: 'Pomodoro timer' },
  { name: 'Automations', href: '/automations', icon: Workflow, description: 'If-then automation rules' },
];

// Get nav item by href
const getNavItem = (href: string): NavItem | undefined => allNavItems.find(item => item.href === href);

// Static sections that cannot be modified
const staticNavSections: NavSection[] = [
  {
    title: 'Main',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
    ],
  },
];

// Default groups that users can customize
const defaultCustomGroups: CustomGroup[] = [
  {
    id: 'communication',
    name: 'Communication',
    items: ['/compose', '/scheduled', '/history'],
    isOpen: true,
  },
  {
    id: 'content',
    name: 'Content',
    items: ['/templates', '/documents', '/snippets', '/contacts'],
    isOpen: true,
  },
  {
    id: 'productivity',
    name: 'Productivity',
    items: ['/calendar', '/tasks', '/notes', '/expenses', '/reminders'],
    isOpen: true,
  },
  {
    id: 'tools',
    name: 'Tools',
    items: ['/activity', '/calculator', '/focus', '/automations'],
    isOpen: false,
  },
];

interface CustomGroupSectionProps {
  group: CustomGroup;
  allGroups: CustomGroup[];
  onToggleOpen: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onAddItem: (href: string) => void;
  onMoveItem: (href: string, toGroupId: string) => void;
  availableItems: NavItem[];
  collapsed?: boolean;
}

function CustomGroupSection({
  group,
  allGroups,
  onToggleOpen,
  onRename,
  onDelete,
  availableItems,
  onAddItem,
  onMoveItem,
  collapsed,
}: CustomGroupSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState<string | null>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState<string | null>(null);
  const [itemMenuPos, setItemMenuPos] = useState<{ top: number; left: number } | null>(null);
  const location = useLocation();

  const groupItems = group.items
    .map(href => getNavItem(href))
    .filter((item): item is NavItem => item !== undefined);

  const hasActiveItem = groupItems.some(item => location.pathname === item.href);

  const handleRename = () => {
    if (editName.trim() && editName !== group.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  // Collapsed mode: just show icons
  if (collapsed) {
    return (
      <div className="mb-2">
        <div className="space-y-0.5">
          {groupItems.map((item) => (
            <div key={item.href} className="mx-1">
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`
                }
                title={item.name}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
              </NavLink>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1 px-2 group/header">
        <button
          onClick={onToggleOpen}
          className="flex-1 flex items-center gap-2 px-1 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${group.isOpen ? '' : '-rotate-90'}`}
          />
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setEditName(group.name);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="flex-1 bg-transparent border-b border-primary-500 outline-none text-xs uppercase tracking-wider"
            />
          ) : (
            <span className="uppercase tracking-wider">{group.name}</span>
          )}
          {!group.isOpen && hasActiveItem && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 ml-auto" />
          )}
        </button>

        {/* Group Actions */}
        <div className="relative">
          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded opacity-0 group-hover/header:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {menuOpen && menuPos && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 min-w-[140px]"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add page
                </button>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete group
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Group Items */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          group.isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mt-1 space-y-0.5">
          {groupItems.length === 0 ? (
            <div className="mx-2 px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
              No pages in this group
            </div>
          ) : (
            groupItems.map((item) => (
              <div key={item.href} className="mx-2 relative group/item">
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1">{item.name}</span>
                </NavLink>

                {/* Item menu button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setItemMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
                    setItemMenuOpen(itemMenuOpen === item.href ? null : item.href);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 transition-all"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </button>

                {/* Item context menu */}
                {itemMenuOpen === item.href && itemMenuPos && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setItemMenuOpen(null)}
                    />
                    <div
                      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 min-w-[140px]"
                      style={{ top: itemMenuPos.top, left: itemMenuPos.left }}
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowMoveModal(item.href);
                          setItemMenuOpen(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      >
                        <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                        Move to...
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Page Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">Add page to {group.name}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {availableItems.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">
                  All pages are already in groups
                </div>
              ) : (
                availableItems.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      onAddItem(item.href);
                      setShowAddModal(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Move Page Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Move "{getNavItem(showMoveModal)?.name}" to...
              </h3>
              <button
                onClick={() => setShowMoveModal(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {allGroups.filter(g => g.id !== group.id).length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">
                  No other groups available
                </div>
              ) : (
                allGroups
                  .filter(g => g.id !== group.id)
                  .map((targetGroup) => (
                    <button
                      key={targetGroup.id}
                      onClick={() => {
                        onMoveItem(showMoveModal, targetGroup.id);
                        setShowMoveModal(null);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                      <span>{targetGroup.name}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CollapsibleSectionProps extends NavSection {
  collapsed?: boolean;
}

function CollapsibleSection({
  title,
  items,
  defaultOpen = true,
  collapsed,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const location = useLocation();

  const hasActiveItem = items.some(item => location.pathname === item.href);

  if (collapsed) {
    return (
      <div className="mb-2">
        <div className="space-y-0.5">
          {items.map((item) => (
            <div key={item.name} className="mx-1">
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`
                }
                title={item.name}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
              </NavLink>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
        />
        <span className="uppercase tracking-wider">{title}</span>
        {!isOpen && hasActiveItem && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 ml-auto" />
        )}
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mt-1 space-y-0.5">
          {items.map((item) => (
            <div key={item.name} className="relative mx-2">
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">{item.name}</span>
              </NavLink>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { theme, setThemeMode } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(defaultCustomGroups);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const sidebarCollapsed = settings.sidebarCollapsed || false;

  const toggleSidebar = useCallback(async () => {
    try {
      await updateSettings({ sidebarCollapsed: !sidebarCollapsed });
    } catch (error) {
      console.error('Failed to toggle sidebar:', error);
    }
  }, [sidebarCollapsed, updateSettings]);

  // Initialize global keyboard shortcuts
  useKeyboardShortcuts();

  // Sync custom groups with settings
  useEffect(() => {
    if (settings.dashboard?.sidebarGroups && settings.dashboard.sidebarGroups.length > 0) {
      setCustomGroups(settings.dashboard.sidebarGroups);
    }
  }, [settings.dashboard?.sidebarGroups]);

  // Save custom groups to settings
  const saveCustomGroups = useCallback(async (groups: CustomGroup[]) => {
    setCustomGroups(groups);
    try {
      await updateSettings({
        dashboard: {
          ...settings.dashboard,
          sidebarGroups: groups,
        },
      });
    } catch (error) {
      console.error('Failed to save sidebar groups:', error);
    }
  }, [settings.dashboard, updateSettings]);

  // Filter nav items based on enabled features
  const enabledFeatures = settings.enabledFeatures || {};
  const isFeatureVisible = (href: string) =>
    href === '/dashboard' || enabledFeatures[href] !== false;

  const visibleNavItems = allNavItems.filter(item => isFeatureVisible(item.href));

  // Filter group items to only show enabled features
  const visibleGroups = customGroups.map(g => ({
    ...g,
    items: g.items.filter(href => isFeatureVisible(href)),
  }));

  // Get items not in any group (for "Add page" functionality)
  const itemsInGroups = new Set(visibleGroups.flatMap(g => g.items));
  const availableItems = visibleNavItems.filter(
    item => !itemsInGroups.has(item.href) && item.href !== '/dashboard'
  );

  // Create new group
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;

    const newGroup: CustomGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      items: [],
      isOpen: true,
    };

    saveCustomGroups([...customGroups, newGroup]);
    setNewGroupName('');
    setShowNewGroupInput(false);
  };

  // Toggle group open/close
  const toggleGroupOpen = (groupId: string) => {
    const updated = customGroups.map(g =>
      g.id === groupId ? { ...g, isOpen: !g.isOpen } : g
    );
    saveCustomGroups(updated);
  };

  // Rename group
  const renameGroup = (groupId: string, newName: string) => {
    const updated = customGroups.map(g =>
      g.id === groupId ? { ...g, name: newName } : g
    );
    saveCustomGroups(updated);
  };

  // Delete group
  const deleteGroup = (groupId: string) => {
    const updated = customGroups.filter(g => g.id !== groupId);
    saveCustomGroups(updated);
  };

  // Add item to group
  const addItemToGroup = (groupId: string, href: string) => {
    const updated = customGroups.map(g =>
      g.id === groupId ? { ...g, items: [...g.items, href] } : g
    );
    saveCustomGroups(updated);
  };

  // Move item from one group to another
  const moveItemToGroup = (fromGroupId: string, href: string, toGroupId: string) => {
    const updated = customGroups.map(g => {
      if (g.id === fromGroupId) {
        return { ...g, items: g.items.filter(i => i !== href) };
      }
      if (g.id === toGroupId) {
        return { ...g, items: [...g.items, href] };
      }
      return g;
    });
    saveCustomGroups(updated);
  };

  // Global keyboard shortcuts
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInputFocused =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }

    if (e.key === '?' && !isInputFocused) {
      e.preventDefault();
      setShortcutsHelpOpen(true);
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  const themeOptions = [
    { mode: 'light' as const, icon: Sun, label: 'Light' },
    { mode: 'dark' as const, icon: Moon, label: 'Dark' },
    { mode: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200`}>
        {/* App Name */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-widest text-gray-900 dark:text-white">
              ENVOY
            </span>
          )}
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${sidebarCollapsed ? 'mx-auto' : ''}`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Search Trigger */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors`}
            title={sidebarCollapsed ? 'Search (Ctrl+K)' : undefined}
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left text-gray-400 dark:text-gray-500">Search...</span>
                <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-600 rounded">
                  <Command className="w-2.5 h-2.5" />K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-1">
          {/* Static Main Section (Dashboard) */}
          {staticNavSections.map((section) => (
            <CollapsibleSection
              key={section.title}
              collapsed={sidebarCollapsed}
              {...section}
            />
          ))}

          {/* Custom Groups */}
          {visibleGroups.map((group) => (
            <CustomGroupSection
              key={group.id}
              group={group}
              allGroups={customGroups}
              onToggleOpen={() => toggleGroupOpen(group.id)}
              onRename={(newName) => renameGroup(group.id, newName)}
              onDelete={() => deleteGroup(group.id)}
              onAddItem={(href) => addItemToGroup(group.id, href)}
              onMoveItem={(href, toGroupId) => moveItemToGroup(group.id, href, toGroupId)}
              availableItems={availableItems}
              collapsed={sidebarCollapsed}
            />
          ))}

          {/* Add New Group */}
          {!sidebarCollapsed && (
            <div className="mx-2 mt-2">
              {showNewGroupInput ? (
                <div className="flex items-center gap-2 px-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateGroup();
                      if (e.key === 'Escape') {
                        setNewGroupName('');
                        setShowNewGroupInput(false);
                      }
                    }}
                    placeholder="Group name..."
                    autoFocus
                    className="flex-1 px-2 py-1 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleCreateGroup}
                    className="p-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-[var(--primary-tint-20)] rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setNewGroupName('');
                      setShowNewGroupInput(false);
                    }}
                    className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewGroupInput(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add group</span>
                </button>
              )}
            </div>
          )}

          {/* Settings - Always visible at bottom of nav */}
          <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 ${sidebarCollapsed ? 'mx-1' : 'mx-2'}`}>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `group flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`
              }
              title={sidebarCollapsed ? 'Settings' : undefined}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </NavLink>
          </div>
        </nav>

        {/* Theme Toggle */}
        <div className={`${sidebarCollapsed ? 'px-1' : 'px-3'} py-2 border-t border-gray-200 dark:border-gray-700`}>
          <div className={`flex ${sidebarCollapsed ? 'flex-col gap-0.5' : 'items-center justify-between'} bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5`}>
            {themeOptions.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  theme.mode === mode
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
              v1.0.0 • ENVOY
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  );
}
