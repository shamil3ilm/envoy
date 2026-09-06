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
import type { Task, CreateTaskInput, TaskStatus, TaskPriority } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  archived: 'Archived',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: '#94a3b8',
  medium: '#0ea5e9',
  high: '#f97316',
};

interface TaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string;
}

const EMPTY_FORM: TaskFormState = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  tags: '',
};

function taskToForm(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    tags: task.tags.join(', '),
  };
}

function formToInput(form: TaskFormState): CreateTaskInput {
  const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    status: form.status,
    priority: form.priority,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export default function TasksScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listTasks();
      setTasks(rows);
    } catch (err) {
      console.error('Failed to load tasks', err);
      Alert.alert('Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const list = filterStatus === 'all' ? tasks : tasks.filter((t) => t.status === filterStatus);
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
      return a.order - b.order;
    });
  }, [tasks, filterStatus]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm(taskToForm(task));
    setFormOpen(true);
  };

  const cycleStatus = async (task: Task) => {
    if (!db) return;
    const next: TaskStatus =
      task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    try {
      await db.updateTask(task.id, { status: next });
      await refresh();
    } catch (err) {
      console.error('Update task status failed', err);
    }
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input.title) {
      Alert.alert('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateTask(editing.id, input);
      } else {
        await db.createTask(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save task failed', err);
      Alert.alert('Could not save task');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (task: Task) => {
    Alert.alert('Delete task?', task.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteTask(task.id);
            await refresh();
          } catch (err) {
            console.error('Delete task failed', err);
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
          {(['all', 'todo', 'in_progress', 'done', 'archived'] as const).map((s) => (
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
          <Text style={styles.emptyTitle}>No tasks</Text>
          <Text style={styles.emptySubtitle}>Tap “+” to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <TouchableOpacity onPress={() => cycleStatus(item)} style={styles.checkbox}>
                <Text style={styles.checkboxText}>
                  {item.status === 'done' ? '✓' : item.status === 'in_progress' ? '◐' : '○'}
                </Text>
              </TouchableOpacity>
              <View style={styles.rowBody}>
                <Text
                  style={[styles.rowTitle, item.status === 'done' && styles.rowTitleDone]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={styles.rowDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLOR[item.priority] }]}>
                <Text style={styles.priorityBadgeText}>{PRIORITY_LABEL[item.priority][0]}</Text>
              </View>
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
            <Text style={styles.modalTitle}>{editing ? 'Edit task' : 'New task'}</Text>
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
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
              multiline
            />
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.chipRow}>
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, form.status === s && styles.chipActive]}
                  onPress={() => setForm({ ...form, status: s })}
                >
                  <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, form.priority === p && styles.chipActive]}
                  onPress={() => setForm({ ...form, priority: p })}
                >
                  <Text style={[styles.chipText, form.priority === p && styles.chipTextActive]}>
                    {PRIORITY_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.tags}
              onChangeText={(v) => setForm({ ...form, tags: v })}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete task</Text>
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
  checkbox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxText: { fontSize: 20, color: '#3b82f6' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, color: '#111827', fontWeight: '500' },
  rowTitleDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  rowDesc: { marginTop: 2, fontSize: 13, color: '#6b7280' },
  priorityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  priorityBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
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
