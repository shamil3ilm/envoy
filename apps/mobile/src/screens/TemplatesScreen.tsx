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
import type { Template, CreateTemplateInput, TemplateCategory, Channel, Tone } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

const CATEGORIES: TemplateCategory[] = [
  'greeting',
  'update',
  'invitation',
  'followup',
  'apology',
  'announcement',
  'custom',
];

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  greeting: 'Greeting',
  update: 'Update',
  invitation: 'Invitation',
  followup: 'Follow-up',
  apology: 'Apology',
  announcement: 'Announcement',
  custom: 'Custom',
};

const CHANNELS: Channel[] = ['email', 'whatsapp', 'teams', 'both'];

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  teams: 'Teams',
  both: 'Any',
};

const TONES: Tone[] = ['formal', 'professional', 'friendly'];

const TONE_LABEL: Record<Tone, string> = {
  formal: 'Formal',
  professional: 'Professional',
  friendly: 'Friendly',
};

interface TemplateFormState {
  name: string;
  category: TemplateCategory;
  channel: Channel;
  subject: string;
  body: string;
  tone: Tone;
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  category: 'custom',
  channel: 'email',
  subject: '',
  body: '',
  tone: 'professional',
};

function templateToForm(t: Template): TemplateFormState {
  return {
    name: t.name,
    category: t.category,
    channel: t.channel,
    subject: t.subject ?? '',
    body: t.body,
    tone: t.tone,
  };
}

function formToInput(f: TemplateFormState): CreateTemplateInput {
  return {
    name: f.name.trim(),
    category: f.category,
    channel: f.channel,
    subject: f.subject.trim() || undefined,
    body: f.body,
    tone: f.tone,
  };
}

export default function TemplatesScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [editing, setEditing] = useState<Template | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listTemplates();
      setTemplates(rows);
    } catch (err) {
      console.error('Failed to load templates', err);
      Alert.alert('Could not load templates');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = templates;
    if (category !== 'all') list = list.filter((t) => t.category === category);
    if (q) {
      list = list.filter((t) =>
        `${t.name} ${t.subject ?? ''} ${t.body}`.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [templates, search, category]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm(templateToForm(t));
    setFormOpen(true);
  };

  const copy = (t: Template) => {
    const text = t.subject ? `${t.subject}\n\n${t.body}` : t.body;
    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: `Copied "${t.name}"` });
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input.name || !input.body) {
      Alert.alert('Name and body are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateTemplate(editing.id, input);
      } else {
        await db.createTemplate(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save template failed', err);
      Alert.alert('Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (t: Template) => {
    Alert.alert('Delete template?', t.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteTemplate(t.id);
            await refresh();
          } catch (err) {
            console.error('Delete template failed', err);
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
          placeholder="Search templates"
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
              {c === 'all' ? 'All' : CATEGORY_LABEL[c as TemplateCategory]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No templates</Text>
          <Text style={styles.emptySubtitle}>Tap “+” to add your first one.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => copy(item)}
              onLongPress={() => openEdit(item)}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardBadge}>{CHANNEL_LABEL[item.channel]}</Text>
              </View>
              {item.subject ? (
                <Text style={styles.cardSubject} numberOfLines={1}>
                  {item.subject}
                </Text>
              ) : null}
              <Text style={styles.cardBody} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.cardMeta}>
                {CATEGORY_LABEL[item.category]} · {TONE_LABEL[item.tone]}
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
            <Text style={styles.modalTitle}>{editing ? 'Edit template' : 'New template'}</Text>
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
            <Text style={styles.fieldLabel}>Channel</Text>
            <View style={styles.chipRow}>
              {CHANNELS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, form.channel === c && styles.chipActive]}
                  onPress={() => setForm({ ...form, channel: c })}
                >
                  <Text style={[styles.chipText, form.channel === c && styles.chipTextActive]}>
                    {CHANNEL_LABEL[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Tone</Text>
            <View style={styles.chipRow}>
              {TONES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, form.tone === t && styles.chipActive]}
                  onPress={() => setForm({ ...form, tone: t })}
                >
                  <Text style={[styles.chipText, form.tone === t && styles.chipTextActive]}>
                    {TONE_LABEL[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {(form.channel === 'email' || form.channel === 'both') && (
              <>
                <Text style={styles.fieldLabel}>Subject</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.subject}
                  onChangeText={(v) => setForm({ ...form, subject: v })}
                />
              </>
            )}
            <Text style={styles.fieldLabel}>Body</Text>
            <Text style={styles.fieldHint}>
              Use {'{{ contact.name }}'} and other Jinja tokens for personalization.
            </Text>
            <TextInput
              style={[styles.fieldInput, styles.textarea]}
              value={form.body}
              onChangeText={(v) => setForm({ ...form, body: v })}
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
                <Text style={styles.deleteButtonText}>Delete template</Text>
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
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  cardBadge: {
    marginLeft: 8,
    fontSize: 11,
    color: '#4338ca',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardSubject: { fontSize: 13, color: '#4b5563', fontWeight: '500', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
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
  fieldHint: { fontSize: 11, color: '#9ca3af', marginBottom: 6 },
  fieldInput: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 8,
  },
  textarea: { height: 200, paddingTop: 12 },
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
