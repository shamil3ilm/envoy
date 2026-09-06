import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CalendarEvent, CreateCalendarEventInput } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

interface CalendarFormState {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
}

const EMPTY_FORM: CalendarFormState = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  allDay: false,
  color: '#3b82f6',
};

const COLOR_OPTIONS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#eab308'];

function toLocalISO(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function eventToForm(e: CalendarEvent): CalendarFormState {
  return {
    title: e.title,
    description: e.description ?? '',
    startDate: e.startDate,
    endDate: e.endDate ?? '',
    allDay: e.allDay,
    color: e.color ?? '#3b82f6',
  };
}

function formToInput(f: CalendarFormState): CreateCalendarEventInput | null {
  if (!f.title.trim() || !f.startDate) return null;
  return {
    title: f.title.trim(),
    description: f.description.trim() || undefined,
    startDate: f.startDate,
    endDate: f.endDate || undefined,
    allDay: f.allDay,
    color: f.color,
  };
}

function formatEventDate(iso: string, allDay: boolean): string {
  try {
    const d = new Date(iso);
    if (allDay) {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
}

function endOfMonth(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${(last.getMonth() + 1).toString().padStart(2, '0')}-${last.getDate().toString().padStart(2, '0')}T23:59:59`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function CalendarScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthDate, setMonthDate] = useState(new Date());
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CalendarFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listCalendarEvents({
        fromDate: startOfMonth(monthDate),
        toDate: endOfMonth(monthDate),
      });
      setEvents(rows);
    } catch (err) {
      console.error('Failed to load events', err);
      Alert.alert('Could not load events');
    } finally {
      setLoading(false);
    }
  }, [db, monthDate]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const groups: { day: string; events: CalendarEvent[] }[] = [];
    for (const e of sorted) {
      const day = e.startDate.slice(0, 10);
      const g = groups[groups.length - 1];
      if (g && g.day === day) {
        g.events.push(e);
      } else {
        groups.push({ day, events: [e] });
      }
    }
    return groups;
  }, [events]);

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    setForm({ ...EMPTY_FORM, startDate: toLocalISO(now) });
    setFormOpen(true);
  };

  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setForm(eventToForm(e));
    setFormOpen(true);
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input) {
      Alert.alert('Title and start date are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateCalendarEvent(editing.id, input);
      } else {
        await db.createCalendarEvent(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save event failed', err);
      Alert.alert('Could not save event');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (e: CalendarEvent) => {
    Alert.alert('Delete event?', e.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteCalendarEvent(e.id);
            await refresh();
          } catch (err) {
            console.error('Delete event failed', err);
          }
        },
      },
    ]);
  };

  const prevMonth = () => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() - 1);
    setMonthDate(d);
  };

  const nextMonth = () => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + 1);
    setMonthDate(d);
  };

  if (!ready || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(monthDate)}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {grouped.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No events</Text>
          <Text style={styles.emptySubtitle}>Nothing scheduled this month.</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.day}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.daySection}>
              <Text style={styles.dayHeader}>
                {new Date(item.day + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              {item.events.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => openEdit(e)}
                  onLongPress={() => confirmDelete(e)}
                  style={({ pressed }) => [styles.eventRow, pressed && styles.rowPressed]}
                >
                  <View style={[styles.eventColor, { backgroundColor: e.color ?? '#3b82f6' }]} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.eventTime}>
                      {formatEventDate(e.startDate, e.allDay)}
                      {e.endDate ? ` – ${formatEventDate(e.endDate, e.allDay)}` : ''}
                    </Text>
                    {e.description ? (
                      <Text style={styles.eventDesc} numberOfLines={1}>
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        />
      )}

      <Modal
        visible={formOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Edit event' : 'New event'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
            />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>All day</Text>
              <Switch
                value={form.allDay}
                onValueChange={(v) => setForm({ ...form, allDay: v })}
              />
            </View>
            <Text style={styles.fieldLabel}>Start (YYYY-MM-DDTHH:mm)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.startDate}
              onChangeText={(v) => setForm({ ...form, startDate: v })}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="2026-09-06T09:00"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.fieldLabel}>End (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.endDate}
              onChangeText={(v) => setForm({ ...form, endDate: v })}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="2026-09-06T10:00"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
              multiline
            />
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setForm({ ...form, color: c })}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    form.color === c && styles.colorDotSelected,
                  ]}
                />
              ))}
            </View>
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete event</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  navButtonText: { fontSize: 20, color: '#374151', lineHeight: 22 },
  monthLabel: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontSize: 22, lineHeight: 24, fontWeight: '600' },
  list: { padding: 12 },
  daySection: { marginBottom: 16 },
  dayHeader: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  eventRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    alignItems: 'stretch',
  },
  rowPressed: { backgroundColor: '#f8fafc' },
  eventColor: { width: 4, borderRadius: 2, marginRight: 12 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  eventTime: { fontSize: 12, color: '#4b5563', marginTop: 2 },
  eventDesc: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptySubtitle: { marginTop: 8, fontSize: 14, color: '#6b7280', textAlign: 'center' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalCancel: { color: '#6b7280', fontSize: 15 },
  modalSave: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  modalSaveDisabled: { color: '#9ca3af' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  form: { padding: 16 },
  fieldLabel: { fontSize: 13, color: '#374151', marginBottom: 6, marginTop: 8, fontWeight: '500' },
  fieldInput: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 8,
  },
  textarea: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  deleteButton: {
    marginTop: 24,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
});
