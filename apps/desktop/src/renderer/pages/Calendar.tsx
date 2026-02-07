import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  DollarSign,
  FileText,
  CheckSquare,
} from 'lucide-react';
import type { CalendarEvent, CreateCalendarEventInput } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

const EVENT_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Yellow' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
];

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Quick action menu state
  const [quickActionDate, setQuickActionDate] = useState<Date | null>(null);
  const [quickActionPosition, setQuickActionPosition] = useState<{ x: number; y: number } | null>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { weekStartDay } = useDateTimeFormat();

  // Editor state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('#3b82f6');

  const toast = useToast();

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  async function loadEvents() {
    try {
      setLoading(true);
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const data = await window.envoy.calendar.list({
        fromDate: monthStart.toISOString(),
        toDate: monthEnd.toISOString(),
      });
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: weekStartDay });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: weekStartDay });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getEventsForDate = (date: Date) =>
    events.filter((e) => isSameDay(new Date(e.startDate), date));

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setQuickActionDate(date);
    setQuickActionPosition({
      x: Math.min(rect.left, window.innerWidth - 200),
      y: rect.bottom + 4,
    });
  };

  const handleAddEvent = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setStartDate(format(date, 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndDate(format(date, 'yyyy-MM-dd'));
    setEndTime('10:00');
    setAllDay(false);
    setColor('#3b82f6');
    setShowEditor(true);
    setQuickActionDate(null);
    setQuickActionPosition(null);
  };

  const handleQuickAction = (action: 'event' | 'expense' | 'note' | 'task') => {
    if (!quickActionDate) return;
    const dateStr = format(quickActionDate, 'yyyy-MM-dd');

    setQuickActionDate(null);
    setQuickActionPosition(null);

    switch (action) {
      case 'event':
        handleAddEvent(quickActionDate);
        break;
      case 'expense':
        navigate(`/expenses?date=${dateStr}`);
        break;
      case 'note':
        navigate(`/notes?date=${dateStr}`);
        break;
      case 'task':
        navigate(`/tasks?date=${dateStr}`);
        break;
    }
  };

  const closeQuickAction = () => {
    setQuickActionDate(null);
    setQuickActionPosition(null);
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || '');
    const start = new Date(event.startDate);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setStartTime(format(start, 'HH:mm'));
    if (event.endDate) {
      const end = new Date(event.endDate);
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
    }
    setAllDay(event.allDay);
    setColor(event.color || '#3b82f6');
    setShowEditor(true);
  };

  const handleSaveEvent = async () => {
    if (!title.trim()) {
      toast.error('Title required', 'Please enter an event title');
      return;
    }

    try {
      const startDateTime = allDay
        ? `${startDate}T00:00:00`
        : `${startDate}T${startTime}:00`;
      const endDateTime = allDay
        ? `${endDate}T23:59:59`
        : `${endDate}T${endTime}:00`;

      if (editingEvent) {
        const updated = await window.envoy.calendar.update(editingEvent.id, {
          title: title.trim(),
          description: description || undefined,
          startDate: startDateTime,
          endDate: endDateTime,
          allDay,
          color,
        });
        setEvents(events.map((e) => (e.id === updated.id ? updated : e)));
        toast.success('Event updated', `"${updated.title}" has been saved`);
      } else {
        const input: CreateCalendarEventInput = {
          title: title.trim(),
          description: description || undefined,
          startDate: startDateTime,
          endDate: endDateTime,
          allDay,
          color,
        };
        const created = await window.envoy.calendar.create(input);
        setEvents([...events, created]);
        toast.success('Event created', `"${created.title}" has been added`);
      }
      setShowEditor(false);
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Failed to save', 'Please try again');
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!confirm(`Delete "${editingEvent.title}"?`)) return;

    try {
      await window.envoy.calendar.delete(editingEvent.id);
      setEvents(events.filter((e) => e.id !== editingEvent.id));
      toast.success('Event deleted', `"${editingEvent.title}" has been removed`);
      setShowEditor(false);
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete', 'Please try again');
    }
  };

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy')}
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => handleAddEvent(new Date())}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New event
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800">
              {(() => {
                const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return [...allDays.slice(weekStartDay), ...allDays.slice(0, weekStartDay)];
              })().map((d) => (
                <div
                  key={d}
                  className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7">
              {days.map((date, i) => {
                const dateEvents = getEventsForDate(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const today = isToday(date);

                return (
                  <div
                    key={i}
                    onClick={(e) => handleDateClick(date, e)}
                    className={`min-h-[100px] border-t border-l border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/50' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                        today
                          ? 'bg-primary-500 text-white'
                          : isCurrentMonth
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {format(date, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dateEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => handleEventClick(event, e)}
                          className="text-xs px-1.5 py-0.5 rounded truncate text-white"
                          style={{ backgroundColor: event.color || '#3b82f6' }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dateEvents.length > 3 && (
                        <div className="text-xs text-gray-400 px-1">
                          +{dateEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                {editingEvent ? 'Edit event' : 'New event'}
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
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Event title"
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
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Add details..."
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">All day</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <CalendarIcon className="w-4 h-4 inline mr-1" />
                    Start
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    End
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        color === c.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              {editingEvent ? (
                <button
                  onClick={handleDeleteEvent}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEvent}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Menu */}
      {quickActionDate && quickActionPosition && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeQuickAction}
          />
          <div
            ref={quickActionRef}
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]"
            style={{
              left: quickActionPosition.x,
              top: quickActionPosition.y,
            }}
          >
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Add to {format(quickActionDate, 'MMM d')}
            </div>
            <button
              onClick={() => handleQuickAction('event')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              <span>Event</span>
            </button>
            <button
              onClick={() => handleQuickAction('expense')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <DollarSign className="w-4 h-4 text-green-500" />
              <span>Expense</span>
            </button>
            <button
              onClick={() => handleQuickAction('note')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Note</span>
            </button>
            <button
              onClick={() => handleQuickAction('task')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <CheckSquare className="w-4 h-4 text-purple-500" />
              <span>Task</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
