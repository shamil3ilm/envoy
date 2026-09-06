import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  Contact,
  Template,
  Task,
  Note,
  Snippet,
  Reminder,
  RichDocument,
  Expense,
} from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

type ResultType =
  | 'contact'
  | 'template'
  | 'task'
  | 'note'
  | 'snippet'
  | 'expense'
  | 'reminder'
  | 'document';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: ResultType;
}

interface Navigation {
  navigate: (tab: string, params?: { screen: string; params?: Record<string, unknown> }) => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  navigation: Navigation;
}

const TYPE_META: Record<ResultType, { label: string; emoji: string; color: string; parent: string; screen: string }> = {
  contact: { label: 'Contact', emoji: '👥', color: '#10b981', parent: 'ContentTab', screen: 'Contacts' },
  template: { label: 'Template', emoji: '📝', color: '#8b5cf6', parent: 'ContentTab', screen: 'Templates' },
  task: { label: 'Task', emoji: '✅', color: '#3b82f6', parent: 'ProductivityTab', screen: 'Tasks' },
  note: { label: 'Note', emoji: '📒', color: '#eab308', parent: 'ProductivityTab', screen: 'Notes' },
  snippet: { label: 'Snippet', emoji: '✂️', color: '#ec4899', parent: 'ContentTab', screen: 'Snippets' },
  expense: { label: 'Expense', emoji: '💰', color: '#f59e0b', parent: 'ProductivityTab', screen: 'Expenses' },
  reminder: { label: 'Reminder', emoji: '🔔', color: '#f97316', parent: 'ProductivityTab', screen: 'Reminders' },
  document: { label: 'Document', emoji: '📄', color: '#6366f1', parent: 'ContentTab', screen: 'Documents' },
};

export function GlobalSearchModal({ visible, onClose, navigation }: Props) {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      return;
    }
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!ready || !db || !visible || debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = debounced.toLowerCase();
        const [contacts, templates, tasks, notes, snippets, expenses, reminders, documents] =
          await Promise.all([
            db.listContacts({ search: debounced }).catch(() => [] as Contact[]),
            db.listTemplates().catch(() => [] as Template[]),
            db.listTasks({ search: debounced }).catch(() => [] as Task[]),
            db.listNotes({ search: debounced }).catch(() => [] as Note[]),
            db.listSnippets({ search: debounced }).catch(() => [] as Snippet[]),
            db.listExpenses({ search: debounced }).catch(() => [] as Expense[]),
            db.listReminders().catch(() => [] as Reminder[]),
            db.listRichDocuments().catch(() => [] as RichDocument[]),
          ]);

        const next: SearchResult[] = [];

        contacts.slice(0, 5).forEach((c) => {
          next.push({
            id: c.id,
            title: c.name,
            subtitle: c.email || c.company || undefined,
            type: 'contact',
          });
        });

        templates
          .filter((t) =>
            t.name?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((t) => {
            next.push({
              id: t.id,
              title: t.name,
              subtitle: t.subject || t.channel,
              type: 'template',
            });
          });

        tasks.slice(0, 5).forEach((t) => {
          next.push({
            id: t.id,
            title: t.title,
            subtitle: t.status ? `Status: ${t.status.replace('_', ' ')}` : undefined,
            type: 'task',
          });
        });

        notes.slice(0, 5).forEach((n) => {
          next.push({
            id: n.id,
            title: n.title || 'Untitled note',
            subtitle: n.content ? n.content.slice(0, 80) : undefined,
            type: 'note',
          });
        });

        snippets.slice(0, 5).forEach((s) => {
          next.push({
            id: s.id,
            title: s.name,
            subtitle: s.shortcut ? `/${s.shortcut}` : undefined,
            type: 'snippet',
          });
        });

        expenses.slice(0, 5).forEach((e) => {
          next.push({
            id: e.id,
            title: e.description || 'Expense',
            subtitle: `${e.currency} ${e.amount}`,
            type: 'expense',
          });
        });

        reminders
          .filter((r) =>
            r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((r) => {
            next.push({
              id: r.id,
              title: r.title,
              subtitle: r.dueAt ? new Date(r.dueAt).toLocaleString() : undefined,
              type: 'reminder',
            });
          });

        documents
          .filter((d) =>
            d.title?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((d) => {
            next.push({
              id: d.id,
              title: d.title || 'Untitled document',
              subtitle: d.isTemplate ? 'Template' : undefined,
              type: 'document',
            });
          });

        if (!cancelled) setResults(next);
      } catch (err) {
        console.error('Global search failed', err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, ready, db, visible]);

  const grouped = useMemo(() => {
    const map = new Map<ResultType, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return Array.from(map.entries());
  }, [results]);

  const jumpTo = useCallback(
    (result: SearchResult) => {
      const meta = TYPE_META[result.type];
      navigation.navigate(meta.parent, { screen: meta.screen });
      onClose();
    },
    [navigation, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Search everything"
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
            returnKeyType="search"
          />
        </View>

        {debounced.length < 2 ? (
          <View style={styles.hintState}>
            <Text style={styles.hintText}>
              Type at least 2 characters to search contacts, templates, tasks,
              notes, snippets, expenses, reminders, and documents.
            </Text>
          </View>
        ) : loading && results.length === 0 ? (
          <View style={styles.hintState}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.hintState}>
            <Text style={styles.hintTitle}>No matches</Text>
            <Text style={styles.hintText}>Try a different term.</Text>
          </View>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={([type]) => type}
            renderItem={({ item: [type, rows] }) => (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: TYPE_META[type].color }]}>
                  {TYPE_META[type].emoji} {TYPE_META[type].label}s
                </Text>
                {rows.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => jumpTo(r)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View
                      style={[styles.dot, { backgroundColor: TYPE_META[type].color }]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {r.title}
                      </Text>
                      {r.subtitle && (
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          {r.subtitle}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  closeButton: { paddingHorizontal: 8, paddingVertical: 8 },
  closeButtonText: { color: '#6b7280', fontSize: 15 },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontSize: 15,
  },
  hintState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  hintTitle: { fontSize: 17, fontWeight: '600', color: '#374151', marginBottom: 6 },
  hintText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  section: { paddingTop: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  rowPressed: { backgroundColor: '#f8fafc' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
