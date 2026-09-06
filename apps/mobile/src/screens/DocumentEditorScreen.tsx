import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RichDocument, Contact } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';
import { renderTemplate } from '../services/TemplateEngine';

type DocumentEditorRoute = RouteProp<
  { DocumentEditor: { documentId?: string } | undefined },
  'DocumentEditor'
>;

interface DocState {
  title: string;
  content: string;
  isTemplate: boolean;
  pageColor: string;
}

const EMPTY_DOC: DocState = {
  title: '',
  content: '',
  isTemplate: false,
  pageColor: '#ffffff',
};

const PAGE_COLORS = ['#ffffff', '#fef3c7', '#dcfce7', '#e0e7ff', '#fce7f3', '#f1f5f9'];

function extractPlaceholders(content: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) set.add(m[1]);
  return Array.from(set);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

function buildContext(contact: Contact | null): Record<string, unknown> {
  if (!contact) return {};
  return {
    contact: {
      name: contact.name,
      first_name: contact.name.split(' ')[0] ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      title: contact.title ?? '',
    },
    name: contact.name,
    first_name: contact.name.split(' ')[0] ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: contact.company ?? '',
    title: contact.title ?? '',
    ...contact.customFields,
  };
}

export default function DocumentEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<DocumentEditorRoute>();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const documentId = route.params?.documentId ?? null;

  const [doc, setDoc] = useState<DocState>(EMPTY_DOC);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [contact, setContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (!ready || !db) return;
    let cancelled = false;
    (async () => {
      try {
        if (documentId) {
          const existing = await db.getRichDocument(documentId);
          if (existing && !cancelled) {
            setDoc({
              title: existing.title,
              content: existing.content,
              isTemplate: existing.isTemplate,
              pageColor: existing.pageColor,
            });
          }
        }
        const cs = await db.listContacts();
        if (!cancelled) setContacts(cs);
      } catch (err) {
        console.error('Failed to load editor', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, ready, documentId]);

  const placeholders = useMemo(() => extractPlaceholders(doc.content), [doc.content]);

  const rendered = useMemo(() => {
    if (!doc.content) return { text: '', error: undefined };
    const result = renderTemplate(doc.content, buildContext(contact));
    return {
      text: result.success ? result.rendered ?? '' : doc.content,
      error: result.error,
    };
  }, [doc.content, contact]);

  const filteredContacts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.email ?? ''} ${c.phone ?? ''} ${c.company ?? ''}`.toLowerCase().includes(q)
    );
  }, [contacts, pickerSearch]);

  const set = <K extends keyof DocState>(key: K, value: DocState[K]) => {
    setDoc((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    if (!db) return;
    if (!doc.title.trim()) {
      Alert.alert('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: doc.title.trim(),
        content: doc.content,
        isTemplate: doc.isTemplate,
        pageColor: doc.pageColor,
        placeholders,
      };
      if (documentId) {
        await db.updateRichDocument(documentId, payload);
      } else {
        const created = await db.createRichDocument(payload);
        navigation.setParams({ documentId: created.id });
      }
      setDirty(false);
      Toast.show({ type: 'success', text1: 'Saved' });
    } catch (err) {
      console.error('Save document failed', err);
      Alert.alert('Could not save document');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const text = doc.title
      ? `${doc.title}\n\n${rendered.text || doc.content}`
      : rendered.text || doc.content;
    if (!text.trim()) {
      Alert.alert('Nothing to share yet');
      return;
    }
    try {
      await Share.share({ title: doc.title || 'Document', message: text });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const remove = () => {
    if (!documentId) return;
    Alert.alert('Delete this document?', doc.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteRichDocument(documentId);
            navigation.goBack();
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
    <View style={[styles.container, { backgroundColor: doc.pageColor }]}>
      <View style={styles.toolbar}>
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'edit' && styles.modeButtonActive]}
            onPress={() => setMode('edit')}
          >
            <Text style={[styles.modeButtonText, mode === 'edit' && styles.modeButtonTextActive]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'preview' && styles.modeButtonActive]}
            onPress={() => setMode('preview')}
          >
            <Text style={[styles.modeButtonText, mode === 'preview' && styles.modeButtonTextActive]}>Preview</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={share} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={save} disabled={!dirty || saving} style={styles.toolbarButton}>
          <Text
            style={[
              styles.toolbarButtonText,
              styles.toolbarSave,
              (!dirty || saving) && styles.toolbarSaveDisabled,
            ]}
          >
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {mode === 'edit' ? (
          <>
            <TextInput
              style={styles.titleInput}
              value={doc.title}
              onChangeText={(v) => set('title', v)}
              placeholder="Untitled document"
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.contentInput}
              value={doc.content}
              onChangeText={(v) => set('content', v)}
              placeholder="Start writing… Use {{ name }} or {{ contact.email }} for template placeholders."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.meta}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Save as reusable template</Text>
                <Switch value={doc.isTemplate} onValueChange={(v) => set('isTemplate', v)} />
              </View>

              <Text style={styles.metaLabel}>Page color</Text>
              <View style={styles.colorRow}>
                {PAGE_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => set('pageColor', c)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      doc.pageColor === c && styles.colorSwatchSelected,
                    ]}
                  />
                ))}
              </View>

              {placeholders.length > 0 && (
                <>
                  <Text style={styles.metaLabel}>Placeholders found</Text>
                  <View style={styles.placeholderRow}>
                    {placeholders.map((p) => (
                      <View key={p} style={styles.placeholderPill}>
                        <Text style={styles.placeholderPillText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {documentId && (
                <TouchableOpacity style={styles.deleteButton} onPress={remove}>
                  <Text style={styles.deleteButtonText}>Delete document</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <View>
            <View style={styles.previewChrome}>
              <View style={styles.previewContactRow}>
                <Text style={styles.previewContactLabel}>Fill with:</Text>
                <TouchableOpacity
                  style={styles.previewContactButton}
                  onPress={() => {
                    setPickerSearch('');
                    setContactPickerOpen(true);
                  }}
                >
                  <Text style={styles.previewContactButtonText}>
                    {contact ? contact.name : 'Pick a contact'}
                  </Text>
                </TouchableOpacity>
                {contact && (
                  <TouchableOpacity onPress={() => setContact(null)} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              {rendered.error && (
                <Text style={styles.previewError}>{rendered.error}</Text>
              )}
            </View>

            <View style={styles.previewPage}>
              <Text style={styles.previewTitle}>{doc.title || 'Untitled document'}</Text>
              <Text style={styles.previewBody}>{rendered.text || 'Nothing to preview yet.'}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={contactPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setContactPickerOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setContactPickerOpen(false)}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pick contact</Text>
            <View style={{ width: 50 }} />
          </View>
          <TextInput
            style={styles.pickerSearch}
            placeholder="Search contacts"
            placeholderTextColor="#9ca3af"
            value={pickerSearch}
            onChangeText={setPickerSearch}
            autoCorrect={false}
          />
          <ScrollView>
            {filteredContacts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No contacts</Text>
              </View>
            ) : (
              filteredContacts.map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
                  onPress={() => {
                    setContact(c);
                    setContactPickerOpen(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(c.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerRowTitle}>{c.name}</Text>
                    {(c.email || c.phone) && (
                      <Text style={styles.pickerRowSub} numberOfLines={1}>
                        {c.email || c.phone}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modeSwitch: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: { backgroundColor: 'white' },
  modeButtonText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  modeButtonTextActive: { color: '#111827' },
  toolbarButton: { paddingHorizontal: 10, paddingVertical: 8 },
  toolbarButtonText: { fontSize: 14, color: '#374151' },
  toolbarSave: { color: '#3b82f6', fontWeight: '600' },
  toolbarSaveDisabled: { color: '#9ca3af' },
  body: { padding: 20, paddingBottom: 60 },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 8,
    marginBottom: 12,
  },
  contentInput: {
    minHeight: 320,
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
    paddingVertical: 8,
  },
  meta: { marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  colorRow: { flexDirection: 'row', marginBottom: 16, gap: 10 },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#111827' },
  placeholderRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  placeholderPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    marginRight: 6,
    marginBottom: 6,
  },
  placeholderPillText: { color: '#4338ca', fontSize: 12, fontWeight: '500' },
  deleteButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  previewChrome: { marginBottom: 12 },
  previewContactRow: { flexDirection: 'row', alignItems: 'center' },
  previewContactLabel: { fontSize: 13, color: '#6b7280', marginRight: 8 },
  previewContactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
  },
  previewContactButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  clearButton: { marginLeft: 8, padding: 4 },
  clearButtonText: { color: '#6b7280', fontSize: 12 },
  previewError: { marginTop: 6, fontSize: 12, color: '#dc2626' },
  previewPage: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  previewTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  previewBody: { fontSize: 15, color: '#111827', lineHeight: 24 },
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
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  pickerSearch: {
    margin: 16,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontSize: 15,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  pickerRowPressed: { backgroundColor: '#f8fafc' },
  pickerRowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  pickerRowSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#4338ca', fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 15, color: '#6b7280' },
});
