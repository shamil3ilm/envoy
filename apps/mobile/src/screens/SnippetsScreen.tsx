import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
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
import Toast from 'react-native-toast-message';
import type { Snippet, CreateSnippetInput, SnippetCategory } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

const CATEGORIES: SnippetCategory[] = ['greeting', 'closing', 'signature', 'paragraph', 'custom'];

const CATEGORY_LABEL: Record<SnippetCategory, string> = {
  greeting: 'Greetings',
  closing: 'Closings',
  signature: 'Signatures',
  paragraph: 'Paragraphs',
  custom: 'Custom',
};

interface SnippetFormState {
  name: string;
  shortcut: string;
  content: string;
  category: SnippetCategory;
}

const EMPTY_FORM: SnippetFormState = {
  name: '',
  shortcut: '',
  content: '',
  category: 'custom',
};

function snippetToForm(s: Snippet): SnippetFormState {
  return { name: s.name, shortcut: s.shortcut, content: s.content, category: s.category };
}

function formToInput(f: SnippetFormState): CreateSnippetInput {
  return {
    name: f.name.trim(),
    shortcut: f.shortcut.trim(),
    content: f.content,
    category: f.category,
  };
}

export default function SnippetsScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<SnippetCategory | 'all'>('all');
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SnippetFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listSnippets();
      setSnippets(rows);
    } catch (err) {
      console.error('Failed to load snippets', err);
      Alert.alert('Could not load snippets');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = snippets;
    if (category !== 'all') list = list.filter((s) => s.category === category);
    if (q) {
      list = list.filter((s) =>
        `${s.name} ${s.shortcut} ${s.content}`.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.usageCount - a.usageCount);
  }, [snippets, search, category]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (s: Snippet) => {
    setEditing(s);
    setForm(snippetToForm(s));
    setFormOpen(true);
  };

  const copy = async (s: Snippet) => {
    Clipboard.setString(s.content);
    if (db) {
      try {
        await db.incrementSnippetUsage(s.id);
      } catch (err) {
        console.error('incrementSnippetUsage failed', err);
      }
    }
    Toast.show({ type: 'success', text1: `Copied "${s.name}"` });
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input.name || !input.shortcut) {
      Alert.alert('Name and shortcut are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateSnippet(editing.id, input);
      } else {
        await db.createSnippet(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save snippet failed', err);
      Alert.alert('Could not save snippet');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (s: Snippet) => {
    Alert.alert('Delete snippet?', s.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteSnippet(s.id);
            await refresh();
          } catch (err) {
            console.error('Delete snippet failed', err);
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
          placeholder="Search snippets"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chipStripInner}
      >
        {(['all', ...CATEGORIES] as const).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
              {c === 'all' ? 'All' : CATEGORY_LABEL[c as SnippetCategory]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No snippets</Text>
          <Text style={styles.emptySubtitle}>Tap “+” to add your first one.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => copy(item)}
              onLongPress={() => openEdit(item)}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardShortcut}>/{item.shortcut}</Text>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <Text style={styles.cardContent} numberOfLines={3}>
                {item.content}
              </Text>
              <Text style={styles.cardMeta}>
                {CATEGORY_LABEL[item.category]} · used {item.usageCount}×
              </Text>
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
            <Text style={styles.modalTitle}>{editing ? 'Edit snippet' : 'New snippet'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <Text style={styles.fieldLabel}>Shortcut</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.shortcut}
              onChangeText={(v) => setForm({ ...form, shortcut: v })}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, form.category === c && styles.chipActive]}
                  onPress={() => setForm({ ...form, category: c })}
                >
                  <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>
                    {CATEGORY_LABEL[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Content</Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={form.content}
              onChangeText={(v) => setForm({ ...form, content: v })}
              multiline
              textAlignVertical="top"
            />
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete snippet</Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontSize: 22, lineHeight: 24, fontWeight: '600' },
  chipStrip: {
    backgroundColor: 'white',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    maxHeight: 44,
  },
  chipStripInner: { paddingHorizontal: 12 },
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
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardShortcut: {
    fontSize: 13,
    color: '#4338ca',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  cardName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  cardContent: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  cardMeta: { marginTop: 6, fontSize: 11, color: '#9ca3af' },
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
  textarea: { height: 140, paddingTop: 12 },
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
