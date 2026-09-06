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
import type { RichDocument, CreateRichDocumentInput } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

interface DocFormState {
  title: string;
  content: string;
  isTemplate: boolean;
}

const EMPTY_FORM: DocFormState = { title: '', content: '', isTemplate: false };

function docToForm(d: RichDocument): DocFormState {
  return { title: d.title, content: d.content, isTemplate: d.isTemplate };
}

function extractPlaceholders(content: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) set.add(m[1]);
  return Array.from(set);
}

function formToInput(f: DocFormState): CreateRichDocumentInput | null {
  if (!f.title.trim()) return null;
  return {
    title: f.title.trim(),
    content: f.content,
    isTemplate: f.isTemplate,
    placeholders: extractPlaceholders(f.content),
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function DocumentsScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [docs, setDocs] = useState<RichDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'documents' | 'templates'>('all');
  const [editing, setEditing] = useState<RichDocument | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DocFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listRichDocuments();
      setDocs(rows);
    } catch (err) {
      console.error('Failed to load documents', err);
      Alert.alert('Could not load documents');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = docs;
    if (tab === 'documents') list = list.filter((d) => !d.isTemplate);
    if (tab === 'templates') list = list.filter((d) => d.isTemplate);
    if (q) {
      list = list.filter((d) => `${d.title} ${d.content}`.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [docs, search, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (d: RichDocument) => {
    setEditing(d);
    setForm(docToForm(d));
    setFormOpen(true);
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input) {
      Alert.alert('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateRichDocument(editing.id, input);
      } else {
        await db.createRichDocument(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save document failed', err);
      Alert.alert('Could not save document');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (d: RichDocument) => {
    Alert.alert('Delete document?', d.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteRichDocument(d.id);
            await refresh();
          } catch (err) {
            console.error('Delete document failed', err);
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
          placeholder="Search documents"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(['all', 'documents', 'templates'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No documents</Text>
          <Text style={styles.emptySubtitle}>Tap “+” to draft one.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.isTemplate && <Text style={styles.templateBadge}>Template</Text>}
              </View>
              <Text style={styles.cardPreview} numberOfLines={3}>
                {item.content || 'No content yet'}
              </Text>
              <Text style={styles.cardMeta}>
                {formatDate(item.updatedAt)}
                {item.placeholders.length > 0
                  ? ` · ${item.placeholders.length} placeholder${item.placeholders.length === 1 ? '' : 's'}`
                  : ''}
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
            <Text style={styles.modalTitle}>{editing ? 'Edit document' : 'New document'}</Text>
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
              placeholder="Draft your content here. Use {{ placeholders }} for templates."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />
            <View style={styles.templateToggle}>
              <Text style={styles.templateToggleLabel}>Save as reusable template</Text>
              <Switch
                value={form.isTemplate}
                onValueChange={(v) => setForm({ ...form, isTemplate: v })}
              />
            </View>
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete document</Text>
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 3,
    backgroundColor: '#f3f4f6',
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  tabTextActive: { color: 'white' },
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
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  templateBadge: {
    marginLeft: 8,
    fontSize: 11,
    color: '#4338ca',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardPreview: { marginTop: 6, fontSize: 13, color: '#4b5563', lineHeight: 18 },
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
    minHeight: 260,
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
    paddingVertical: 8,
    marginBottom: 12,
  },
  templateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  templateToggleLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
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
