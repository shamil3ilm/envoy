import { useEffect, useState } from 'react';
import { Plus, Search, StickyNote, Pin, Trash2, MoreHorizontal, X, Folder, FolderPlus, ChevronRight, Edit2, LayoutGrid, LayoutList } from 'lucide-react';
import type { Note, CreateNoteInput, NoteGroup, CreateNoteGroupInput, NotesViewMode } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { useActivityLog } from '../hooks/useActivityLog';
import DateRangeFilter, { DateRange } from '../components/DateRangeFilter';
import { parseISO, isWithinInterval, format } from 'date-fns';

const NOTE_COLORS = [
  { value: undefined, label: 'Default', bg: 'bg-white dark:bg-gray-800' },
  { value: '#fef3c7', label: 'Yellow', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  { value: '#dbeafe', label: 'Blue', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: '#dcfce7', label: 'Green', bg: 'bg-green-100 dark:bg-green-900/30' },
  { value: '#fce7f3', label: 'Pink', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  { value: '#f3e8ff', label: 'Purple', bg: 'bg-purple-100 dark:bg-purple-900/30' },
];

const GROUP_COLORS = [
  { value: '#6b7280', label: 'Gray' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<NoteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [viewMode, setViewMode] = useState<NotesViewMode>('grid');
  const { logNoteCreated, logNoteUpdated, logNoteDeleted } = useActivityLog();

  // Group modal state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NoteGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#6b7280');

  // Idempotency states
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // Editor state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<string | undefined>(undefined);
  const [isPinned, setIsPinned] = useState(false);
  const [noteGroupId, setNoteGroupId] = useState<string | undefined>(undefined);

  const toast = useToast();
  const { preferences } = useSettings();

  // Sync view mode with preferences
  useEffect(() => {
    const defaultView = preferences.defaultNotesView;
    if (defaultView && (defaultView === 'grid' || defaultView === 'list')) {
      setViewMode(defaultView);
    }
  }, [preferences.defaultNotesView]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [notesData, groupsData] = await Promise.all([
        window.envoy.notes.list(),
        window.envoy.noteGroups.list(),
      ]);
      setNotes(notesData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter notes by search, group, and date range
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // Group filter
    if (selectedGroupId !== 'all') {
      if (selectedGroupId === null) {
        if (n.groupId) return false;
      } else if (n.groupId !== selectedGroupId) {
        return false;
      }
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const noteDate = parseISO(n.updatedAt);
      if (dateRange.from && dateRange.to) {
        if (!isWithinInterval(noteDate, { start: dateRange.from, end: dateRange.to })) {
          return false;
        }
      } else if (dateRange.from) {
        if (noteDate < dateRange.from) return false;
      } else if (dateRange.to) {
        if (noteDate > dateRange.to) return false;
      }
    }

    return true;
  });

  // Sort: pinned first, then by updated date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleCreateNote = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setColor(undefined);
    setIsPinned(false);
    setNoteGroupId(selectedGroupId === 'all' || selectedGroupId === null ? undefined : selectedGroupId);
    setShowEditor(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
    setIsPinned(note.isPinned);
    setNoteGroupId(note.groupId);
    setShowEditor(true);
    setOpenMenuId(null);
  };

  const handleSaveNote = async () => {
    if (!title.trim()) {
      toast.error('Missing title', 'Please enter a note title');
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      if (editingNote) {
        const updated = await window.envoy.notes.update(editingNote.id, {
          title: title.trim(),
          content,
          color,
          isPinned,
          groupId: noteGroupId || undefined,
        });
        setNotes(notes.map((n) => (n.id === updated.id ? updated : n)));
        toast.success('Note saved', `"${updated.title}" has been updated`);
        logNoteUpdated(updated.id, updated.title);
      } else {
        const input: CreateNoteInput = {
          title: title.trim(),
          content,
          color,
          isPinned,
          groupId: noteGroupId,
        };
        const created = await window.envoy.notes.create(input);
        setNotes([created, ...notes]);
        toast.success('Note created', `"${created.title}" has been added`);
        logNoteCreated(created.id, created.title);
      }
      setShowEditor(false);
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Save failed', 'Could not save the note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (deletingNoteId) return;
    if (!confirm(`Delete "${note.title}"?`)) return;
    setDeletingNoteId(note.id);
    try {
      await window.envoy.notes.delete(note.id);
      setNotes(notes.filter((n) => n.id !== note.id));
      toast.success('Note deleted', `"${note.title}" has been removed`);
      logNoteDeleted(note.id, note.title);
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Delete failed', 'Could not delete the note');
    } finally {
      setDeletingNoteId(null);
    }
    setOpenMenuId(null);
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const updated = await window.envoy.notes.update(note.id, {
        isPinned: !note.isPinned,
      });
      setNotes(notes.map((n) => (n.id === updated.id ? updated : n)));
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
    setOpenMenuId(null);
  };

  // Group operations
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupColor('#6b7280');
    setShowGroupModal(true);
  };

  const handleEditGroup = (group: NoteGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupColor(group.color);
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Missing name', 'Please enter a group name');
      return;
    }

    if (savingGroup) return;
    setSavingGroup(true);

    try {
      if (editingGroup) {
        const updated = await window.envoy.noteGroups.update(editingGroup.id, {
          name: groupName.trim(),
          color: groupColor,
        });
        setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));
        toast.success('Group saved', `"${updated.name}" has been updated`);
      } else {
        const input: CreateNoteGroupInput = {
          name: groupName.trim(),
          color: groupColor,
        };
        const created = await window.envoy.noteGroups.create(input);
        setGroups([...groups, created]);
        toast.success('Group created', `"${created.name}" has been added`);
      }
      setShowGroupModal(false);
    } catch (error) {
      console.error('Failed to save group:', error);
      toast.error('Save failed', 'Could not save the group');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: NoteGroup) => {
    if (deletingGroupId) return;
    const notesInGroup = notes.filter((n) => n.groupId === group.id).length;
    const message = notesInGroup > 0
      ? `Delete "${group.name}"? ${notesInGroup} note(s) will be moved to Ungrouped.`
      : `Delete "${group.name}"?`;

    if (!confirm(message)) return;
    setDeletingGroupId(group.id);

    try {
      await window.envoy.noteGroups.delete(group.id);
      setGroups(groups.filter((g) => g.id !== group.id));
      // Move notes to ungrouped
      setNotes(notes.map((n) => n.groupId === group.id ? { ...n, groupId: undefined } : n));
      if (selectedGroupId === group.id) setSelectedGroupId('all');
      toast.success('Group deleted', `"${group.name}" has been removed`);
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Delete failed', 'Could not delete the group');
    } finally {
      setDeletingGroupId(null);
    }
  };

  const getNoteBackground = (noteColor?: string) => {
    const found = NOTE_COLORS.find((c) => c.value === noteColor);
    return found?.bg || NOTE_COLORS[0].bg;
  };

  const getGroupById = (id?: string) => groups.find((g) => g.id === id);

  const ungroupedCount = notes.filter((n) => !n.groupId).length;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900 flex">
      {/* Sidebar - Groups */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Groups</h2>
            <button
              onClick={handleCreateGroup}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="New group"
            >
              <FolderPlus className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <nav className="space-y-1">
            {/* All Notes */}
            <button
              onClick={() => setSelectedGroupId('all')}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedGroupId === 'all'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <StickyNote className="w-4 h-4" />
              <span className="flex-1 text-left">All Notes</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{notes.length}</span>
            </button>

            {/* Ungrouped */}
            <button
              onClick={() => setSelectedGroupId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedGroupId === null
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span className="flex-1 text-left">Ungrouped</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{ungroupedCount}</span>
            </button>

            {/* Divider */}
            {groups.length > 0 && (
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
            )}

            {/* Groups */}
            {groups.map((group) => {
              const count = notes.filter((n) => n.groupId === group.id).length;
              return (
                <div key={group.id} className="group relative">
                  <button
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedGroupId === group.id
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <Folder className="w-4 h-4" style={{ color: group.color }} />
                    <span className="flex-1 text-left truncate">{group.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{count}</span>
                  </button>

                  {/* Group actions on hover */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditGroup(group);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      <Edit2 className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group);
                      }}
                      disabled={deletingGroupId === group.id}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50"
                    >
                      <Trash2 className={`w-3 h-3 ${deletingGroupId === group.id ? 'animate-pulse text-red-400' : 'text-gray-400'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {selectedGroupId === 'all' && 'All Notes'}
                {selectedGroupId === null && 'Ungrouped'}
                {selectedGroupId && selectedGroupId !== 'all' && getGroupById(selectedGroupId)?.name}
              </h1>
              {selectedGroupId && selectedGroupId !== 'all' && selectedGroupId !== null && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getGroupById(selectedGroupId)?.color }}
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="List view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleCreateNote}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New note
              </button>
            </div>
          </div>
        </div>

        {/* Search and filters */}
        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6">
          <div className="flex items-center gap-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
          ) : sortedNotes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <StickyNote className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                {search ? 'No notes found' : 'No notes yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {search ? 'Try a different search' : 'Create your first note to get started'}
              </p>
              {!search && (
                <button
                  onClick={handleCreateNote}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                >
                  Create a note
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleEditNote(note)}
                  className={`group relative p-4 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow ${getNoteBackground(note.color)}`}
                >
                  {/* Pin indicator */}
                  {note.isPinned && (
                    <Pin className="absolute top-3 right-3 w-4 h-4 text-gray-400 fill-current" />
                  )}

                  {/* Group indicator */}
                  {note.groupId && (
                    <div
                      className="absolute top-3 left-3 w-2 h-2 rounded-full"
                      style={{ backgroundColor: getGroupById(note.groupId)?.color }}
                      title={getGroupById(note.groupId)?.name}
                    />
                  )}

                  {/* Content */}
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 pr-6 pl-4 line-clamp-1">
                    {note.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
                    {note.content || 'No content'}
                  </p>

                  {/* Actions */}
                  <div className={`absolute top-3 right-3 transition-opacity z-20 ${openMenuId === note.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === note.id ? null : note.id);
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>

                    {openMenuId === note.id && (
                      <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-30 min-w-[120px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNote(note);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                        >
                          <Pin className="w-4 h-4" />
                          {note.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note);
                          }}
                          disabled={deletingNoteId === note.id}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-8"></th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Group</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Updated</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedNotes.map((note) => (
                    <tr
                      key={note.id}
                      onClick={() => handleEditNote(note)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        {note.isPinned && <Pin className="w-4 h-4 text-gray-400 fill-current" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {note.color && (
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: note.color }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{note.title}</div>
                            {note.content && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{note.content}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {note.groupId ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getGroupById(note.groupId)?.color }}
                            />
                            {getGroupById(note.groupId)?.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {format(parseISO(note.updatedAt), 'MMM d, yyyy')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === note.id ? null : note.id);
                            }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                          {openMenuId === note.id && (
                            <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-30 min-w-[120px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditNote(note);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePin(note);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                              >
                                <Pin className="w-4 h-4" />
                                {note.isPinned ? 'Unpin' : 'Pin'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNote(note);
                                }}
                                disabled={deletingNoteId === note.id}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingNote ? 'Edit note' : 'New note'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Note title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-0 py-2 text-xl font-medium bg-transparent text-gray-900 dark:text-white border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                />
              </div>

              <div>
                <textarea
                  placeholder="Start writing..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full px-0 py-2 bg-transparent border-0 focus:ring-0 placeholder-gray-400 resize-none text-gray-700 dark:text-gray-300"
                />
              </div>

              {/* Group selector */}
              <div>
                <div className="text-xs text-gray-400 uppercase mb-2">Group</div>
                <select
                  value={noteGroupId || ''}
                  onChange={(e) => setNoteGroupId(e.target.value || undefined)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Ungrouped</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color picker */}
              <div>
                <div className="text-xs text-gray-400 uppercase mb-2">Color</div>
                <div className="flex gap-2">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${c.bg} ${
                        color === c.value
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Pin toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Pin to top</span>
              </label>
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
                onClick={handleSaveNote}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingGroup ? 'Edit group' : 'New group'}
              </h2>
              <button
                onClick={() => setShowGroupModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase mb-2 block">Name</label>
                <input
                  type="text"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setGroupColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        groupColor === c.value
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroup}
                disabled={savingGroup}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingGroup ? 'Saving...' : 'Save'}
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
