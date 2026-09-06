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
import type { Note, CreateNoteInput } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

interface NoteFormState {
  title: string;
  content: string;
  tags: string;
  isPinned: boolean;
}

const EMPTY_FORM: NoteFormState = { title: '', content: '', tags: '', isPinned: false };

function noteToForm(note: Note): NoteFormState {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags.join(', '),
    isPinned: note.isPinned,
  };
}

function formToInput(form: NoteFormState): CreateNoteInput {
  const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
  return {
    title: form.title.trim(),
    content: form.content,
    tags: tags.length > 0 ? tags : undefined,
    isPinned: form.isPinned,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function NotesScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NoteFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listNotes();
      setNotes(rows);
    } catch (err) {
      console.error('Failed to load notes', err);
      Alert.alert('Could not load notes');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    if (!q) return sorted;
    return sorted.filter((n) =>
      `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditing(note);
    setForm(noteToForm(note));
    setFormOpen(true);
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
        await db.updateNote(editing.id, input);
      } else {
        await db.createNote(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save note failed', err);
      Alert.alert('Could not save note');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (note: Note) => {
    Alert.alert('Delete note?', note.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteNote(note.id);
            await refresh();
          } catch (err) {
            console.error('Delete note failed', err);
            Alert.alert('Could not delete note');
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
        <TextInput
          style={styles.search}
          placeholder="Search notes"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {notes.length === 0 ? 'No notes yet' : 'No matches'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {notes.length === 0 ? 'Tap “+ Add” to create your first note.' : 'Try a different search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.isPinned ? '📌  ' : ''}
                  {item.title}
                </Text>
                <Text style={styles.cardDate}>{formatDate(item.updatedAt)}</Text>
              </View>
              {item.content ? (
                <Text style={styles.cardBody} numberOfLines={2}>
                  {item.content}
                </Text>
              ) : null}
              {item.tags.length > 0 && (
                <Text style={styles.cardTags} numberOfLines={1}>
                  {item.tags.map((t) => `#${t}`).join(' ')}
                </Text>
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
            <Text style={styles.modalTitle}>{editing ? 'Edit note' : 'New note'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <TextInput
              style={styles.titleInput}
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
              placeholder="Title"
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.contentInput}
              value={form.content}
              onChangeText={(v) => setForm({ ...form, content: v })}
              placeholder="Start typing…"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.tagsInput}
              value={form.tags}
              onChangeText={(v) => setForm({ ...form, tags: v })}
              placeholder="Tags (comma-separated)"
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.pinToggle}
              onPress={() => setForm({ ...form, isPinned: !form.isPinned })}
            >
              <Text style={styles.pinToggleText}>
                {form.isPinned ? '📌 Pinned' : '📍 Pin to top'}
              </Text>
            </TouchableOpacity>
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete note</Text>
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
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  search: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontSize: 15,
  },
  addButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  list: { padding: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardPressed: { backgroundColor: '#f8fafc' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  cardDate: { fontSize: 12, color: '#9ca3af', marginLeft: 8 },
  cardBody: { marginTop: 6, fontSize: 14, color: '#4b5563', lineHeight: 20 },
  cardTags: { marginTop: 8, fontSize: 12, color: '#6366f1' },
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
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    marginBottom: 12,
  },
  contentInput: {
    minHeight: 200,
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
    paddingVertical: 8,
    marginBottom: 12,
  },
  tagsInput: {
    height: 40,
    fontSize: 14,
    color: '#111827',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  pinToggle: { marginTop: 12, paddingVertical: 10 },
  pinToggleText: { fontSize: 14, color: '#4b5563' },
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
