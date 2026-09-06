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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Reminder, CreateReminderInput, ReminderType, ReminderStatus } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';
import {
  cancelReminderNotification,
  requestNotificationPermission,
  scheduleReminderNotification,
} from '../services/NotificationService';

const TYPES: ReminderType[] = ['follow_up', 'task', 'custom', 'medical'];
const TYPE_LABEL: Record<ReminderType, string> = {
  follow_up: 'Follow-up',
  task: 'Task',
  custom: 'Custom',
  medical: 'Medical',
};

const STATUS_LABEL: Record<ReminderStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
};

interface ReminderFormState {
  title: string;
  description: string;
  type: ReminderType;
  dueAt: string;
}

const EMPTY_FORM: ReminderFormState = {
  title: '',
  description: '',
  type: 'custom',
  dueAt: '',
};

function toLocalISO(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function reminderToForm(r: Reminder): ReminderFormState {
  return {
    title: r.title,
    description: r.description ?? '',
    type: r.type,
    dueAt: r.dueAt,
  };
}

function formToInput(f: ReminderFormState): CreateReminderInput | null {
  if (!f.title.trim() || !f.dueAt) return null;
  return {
    type: f.type,
    title: f.title.trim(),
    description: f.description.trim() || undefined,
    dueAt: f.dueAt,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function formatDue(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const minutes = Math.round(abs / 60000);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    if (abs < 60_000) return diff > 0 ? 'in a moment' : 'just now';
    if (minutes < 60) return diff > 0 ? `in ${minutes}m` : `${minutes}m ago`;
    if (hours < 24) return diff > 0 ? `in ${hours}h` : `${hours}h ago`;
    if (days < 7) return diff > 0 ? `in ${days}d` : `${days}d ago`;
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function RemindersScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ReminderStatus | 'all'>('pending');
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ReminderFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listReminders();
      setReminders(rows);
    } catch (err) {
      console.error('Failed to load reminders', err);
      Alert.alert('Could not load reminders');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const list = filterStatus === 'all' ? reminders : reminders.filter((r) => r.status === filterStatus);
    return [...list].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [reminders, filterStatus]);

  const openCreate = () => {
    setEditing(null);
    const t = new Date();
    t.setMinutes(t.getMinutes() + 30);
    t.setSeconds(0, 0);
    setForm({ ...EMPTY_FORM, dueAt: toLocalISO(t) });
    setFormOpen(true);
  };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setForm(reminderToForm(r));
    setFormOpen(true);
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input) {
      Alert.alert('Title and due date are required');
      return;
    }
    setSaving(true);
    try {
      const saved = editing
        ? await db.updateReminder(editing.id, input)
        : await db.createReminder(input);
      await cancelReminderNotification(saved.id);
      if (saved.status === 'pending') {
        await scheduleReminderNotification({
          reminderId: saved.id,
          title: saved.title,
          description: saved.description,
          fireAtIso: saved.dueAt,
        });
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save reminder failed', err);
      Alert.alert('Could not save reminder');
    } finally {
      setSaving(false);
    }
  };

  const complete = async (r: Reminder) => {
    if (!db) return;
    try {
      await db.updateReminder(r.id, { status: 'completed' });
      await cancelReminderNotification(r.id);
      await refresh();
    } catch (err) {
      console.error('Complete reminder failed', err);
    }
  };

  const dismiss = async (r: Reminder) => {
    if (!db) return;
    try {
      await db.updateReminder(r.id, { status: 'dismissed' });
      await cancelReminderNotification(r.id);
      await refresh();
    } catch (err) {
      console.error('Dismiss reminder failed', err);
    }
  };

  const confirmDelete = (r: Reminder) => {
    Alert.alert('Delete reminder?', r.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteReminder(r.id);
            await cancelReminderNotification(r.id);
            await refresh();
          } catch (err) {
            console.error('Delete reminder failed', err);
          }
        },
      },
    ]);
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'pending', 'completed', 'snoozed', 'dismissed'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilterStatus(s)}
              style={[styles.chip, filterStatus === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, filterStatus === s && styles.chipTextActive]}>
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No reminders</Text>
          <Text style={styles.emptySubtitle}>Tap “+” to schedule one.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{TYPE_LABEL[item.type][0]}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowDue}>
                  {formatDue(item.dueAt)} · {STATUS_LABEL[item.status]}
                </Text>
                {item.description ? (
                  <Text style={styles.rowDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
              </View>
              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => complete(item)} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => dismiss(item)} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
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
            <Text style={styles.modalTitle}>{editing ? 'Edit reminder' : 'New reminder'}</Text>
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
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm({ ...form, type: t })}
                  style={[styles.chip, form.type === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>
                    {TYPE_LABEL[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Due at (YYYY-MM-DDTHH:mm)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.dueAt}
              onChangeText={(v) => setForm({ ...form, dueAt: v })}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="2026-09-06T09:00"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
              multiline
            />
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete reminder</Text>
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
    padding: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: { paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#4b5563' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontSize: 22, lineHeight: 24, fontWeight: '600' },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  rowPressed: { backgroundColor: '#f8fafc' },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeBadgeText: { color: '#4338ca', fontWeight: '700', fontSize: 13 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, color: '#111827', fontWeight: '600' },
  rowDue: { marginTop: 2, fontSize: 12, color: '#4b5563' },
  rowDesc: { marginTop: 2, fontSize: 12, color: '#9ca3af' },
  actions: { flexDirection: 'row', marginLeft: 8, gap: 6 },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  actionButtonText: { fontSize: 15, color: '#374151' },
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
