import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Trash2, Edit2, Calendar, Flag, X, LayoutList, Kanban, Archive, RotateCcw, RefreshCw } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput, TasksViewMode, RecurrenceRule } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { useUserProfiles } from '../hooks/useUserProfiles';
import { useActivityLog } from '../hooks/useActivityLog';
import { format } from 'date-fns';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
];

const ALL_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  ...COLUMNS,
  { id: 'archived', label: 'Archived', color: 'bg-gray-400' },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-500 dark:text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-amber-500' },
  { value: 'high', label: 'High', color: 'text-red-500' },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TasksViewMode>('kanban');
  const [showArchived, setShowArchived] = useState(false);
  const { logTaskCreated, logTaskUpdated, logTaskDeleted, logTaskArchived } = useActivityLog();

  // Editor state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | ''>('');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const toast = useToast();
  const { preferences } = useSettings();
  const { suggestedTaskTags } = useUserProfiles();

  // Sync view mode with preferences
  useEffect(() => {
    const defaultView = preferences.defaultTasksView;
    if (defaultView && (defaultView === 'kanban' || defaultView === 'list')) {
      setViewMode(defaultView);
    }
  }, [preferences.defaultTasksView]);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      const data = await window.envoy.tasks.list();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order);

  const handleCreateTask = (columnStatus: TaskStatus = 'todo') => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setStatus(columnStatus);
    setRecurrenceRule('');
    setRecurrenceInterval(1);
    setRecurrenceEndDate('');
    setShowEditor(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setStatus(task.status);
    setRecurrenceRule(task.recurrence?.rule || '');
    setRecurrenceInterval(task.recurrence?.interval || 1);
    setRecurrenceEndDate(task.recurrence?.endDate ? task.recurrence.endDate.split('T')[0] : '');
    setShowEditor(true);
    setOpenMenuId(null);
  };

  const handleSaveTask = async () => {
    if (!title.trim()) {
      toast.error('Missing title', 'Please enter a task title');
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const recurrence = recurrenceRule
        ? { rule: recurrenceRule as RecurrenceRule, interval: recurrenceInterval, endDate: recurrenceEndDate || undefined }
        : undefined;

      if (editingTask) {
        const updated = await window.envoy.tasks.update(editingTask.id, {
          title: title.trim(),
          description: description || undefined,
          priority,
          dueDate: dueDate || undefined,
          status,
          recurrence: recurrence || (editingTask.recurrence ? null as any : undefined),
        });
        setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
        toast.success('Task saved', `"${updated.title}" has been updated`);
        logTaskUpdated(updated.id, updated.title);
      } else {
        const input: CreateTaskInput = {
          title: title.trim(),
          description: description || undefined,
          priority,
          dueDate: dueDate || undefined,
          status,
          recurrence,
        };
        const created = await window.envoy.tasks.create(input);
        setTasks([...tasks, created]);
        toast.success('Task created', `"${created.title}" has been added`);
        logTaskCreated(created.id, created.title);
      }
      setShowEditor(false);
    } catch (error) {
      console.error('Failed to save task:', error);
      toast.error('Save failed', 'Could not save the task');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (deletingId) return;
    if (!confirm(`Delete "${task.title}"?`)) return;
    setDeletingId(task.id);
    try {
      await window.envoy.tasks.delete(task.id);
      setTasks(tasks.filter((t) => t.id !== task.id));
      toast.success('Task deleted', `"${task.title}" has been removed`);
      logTaskDeleted(task.id, task.title);
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Delete failed', 'Could not delete the task');
    } finally {
      setDeletingId(null);
    }
    setOpenMenuId(null);
  };

  const handleArchiveTask = async (task: Task) => {
    try {
      const newStatus: TaskStatus = task.status === 'archived' ? 'done' : 'archived';
      const updated = await window.envoy.tasks.update(task.id, { status: newStatus });
      setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(
        newStatus === 'archived' ? 'Task archived' : 'Task restored',
        `"${task.title}" has been ${newStatus === 'archived' ? 'archived' : 'restored'}`
      );
      logTaskArchived(task.id, task.title, newStatus === 'archived');
    } catch (error) {
      console.error('Failed to archive task:', error);
      toast.error('Failed', 'Could not update the task');
    }
    setOpenMenuId(null);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDrop = async (targetStatus: TaskStatus) => {
    if (!draggedTask || draggedTask.status === targetStatus) return;

    try {
      if (targetStatus === 'done' && draggedTask.recurrence) {
        const result = await window.envoy.tasks.completeRecurring(draggedTask.id);
        let updated = tasks.map((t) => (t.id === result.completedTask.id ? result.completedTask : t));
        if (result.nextTask) {
          updated = [...updated, result.nextTask];
          toast.success('Recurring task', `Next occurrence created for ${format(new Date(result.nextTask.dueDate!), 'MMM d, yyyy')}`);
        }
        setTasks(updated);
      } else {
        const updated = await window.envoy.tasks.update(draggedTask.id, {
          status: targetStatus,
        });
        setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch (error) {
      console.error('Failed to move task:', error);
    }
  };

  const getPriorityColor = (p: TaskPriority) => {
    return PRIORITIES.find((pr) => pr.value === p)?.color || 'text-gray-500';
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <div
      draggable
      onDragStart={() => handleDragStart(task)}
      onDragEnd={handleDragEnd}
      className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-move hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white flex-1">{task.title}</h4>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === task.id ? null : task.id);
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>

          {openMenuId === task.id && (
            <div className="absolute right-0 top-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10 min-w-[120px]">
              <button
                onClick={() => handleEditTask(task)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => handleArchiveTask(task)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
              >
                {task.status === 'archived' ? (
                  <><RotateCcw className="w-3.5 h-3.5" /> Restore</>
                ) : (
                  <><Archive className="w-3.5 h-3.5" /> Archive</>
                )}
              </button>
              <button
                onClick={() => handleDeleteTask(task)}
                disabled={deletingId === task.id}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingId === task.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p className={`text-xs mt-1 line-clamp-2 ${task.status === 'archived' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>{task.description}</p>
      )}

      <div className="flex items-center gap-3 mt-2">
        <Flag className={`w-3.5 h-3.5 ${getPriorityColor(task.priority)}`} />
        {task.dueDate && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(task.dueDate), 'MMM d')}
          </span>
        )}
        {task.recurrence && (
          <span className="text-xs text-primary-500 flex items-center gap-1" title={`Repeats every ${task.recurrence.interval} ${task.recurrence.rule}`}>
            <RefreshCw className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {tasks.filter((t) => t.status !== 'archived').length} active · {tasks.filter((t) => t.status === 'done').length} completed · {tasks.filter((t) => t.status === 'archived').length} archived
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Archive toggle */}
            {tasks.some((t) => t.status === 'archived') && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${
                  showArchived
                    ? 'border-primary-500 bg-primary-50 dark:bg-[var(--primary-tint-20)] text-primary-700 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archived
              </button>
            )}
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="Kanban view"
              >
                <Kanban className="w-4 h-4" />
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
              onClick={() => handleCreateTask()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board */
          <div className={`grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 ${showArchived ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {(showArchived ? ALL_COLUMNS : COLUMNS).map((column) => (
              <div
                key={column.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(column.id)}
                className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-h-[400px] ${
                  draggedTask && draggedTask.status !== column.id
                    ? 'ring-2 ring-primary-500 ring-opacity-50'
                    : ''
                }`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {column.label}
                    </h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {getTasksByStatus(column.id).length}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCreateTask(column.id)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Tasks */}
                <div className="space-y-2">
                  {getTasksByStatus(column.id).map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>

                {/* Empty state */}
                {getTasksByStatus(column.id).length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400 dark:text-gray-500">No tasks</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {tasks.filter((t) => showArchived || t.status !== 'archived').length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No tasks yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 first:rounded-t-xl">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 first:rounded-tl-xl">Task</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-28">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-24">Priority</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-28">Due Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-16 last:rounded-tr-xl"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tasks.filter((t) => showArchived || t.status !== 'archived').map((task) => (
                    <tr key={task.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${task.status === 'archived' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <div className={`text-sm font-medium ${task.status === 'archived' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{task.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === 'todo' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                          task.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          task.status === 'archived' ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' :
                          'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${ALL_COLUMNS.find(c => c.id === task.status)?.color || 'bg-gray-400'}`} />
                          {ALL_COLUMNS.find(c => c.id === task.status)?.label || task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${getPriorityColor(task.priority)}`}>
                          {PRIORITIES.find(p => p.value === task.priority)?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(task.dueDate), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                          {openMenuId === task.id && (
                            <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-20 min-w-[120px]">
                              <button
                                onClick={() => handleEditTask(task)}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleArchiveTask(task)}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                              >
                                {task.status === 'archived' ? (
                                  <><RotateCcw className="w-3.5 h-3.5" /> Restore</>
                                ) : (
                                  <><Archive className="w-3.5 h-3.5" /> Archive</>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                disabled={deletingId === task.id}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {deletingId === task.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                {editingTask ? 'Edit task' : 'New task'}
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
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Task title"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Add details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {ALL_COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Repeat
                </label>
                <select
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule | '')}
                  className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                {recurrenceRule && (
                  <div className="mt-3 space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Every</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={recurrenceInterval}
                        onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {recurrenceRule === 'daily' ? 'day(s)' : recurrenceRule === 'weekly' ? 'week(s)' : 'month(s)'}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        End date (optional)
                      </label>
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        className="w-full px-2 py-1 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested tags from user profiles */}
              {suggestedTaskTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Suggested tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTaskTags.map((tag) => {
                      const isInTitle = title.toLowerCase().includes(tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (!isInTitle) {
                              setTitle((prev) => (prev ? `${prev} [${tag}]` : `[${tag}]`));
                            }
                          }}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                            isInTitle
                              ? 'bg-primary-100 dark:bg-[var(--primary-tint-30)] border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                              : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                onClick={handleSaveTask}
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
