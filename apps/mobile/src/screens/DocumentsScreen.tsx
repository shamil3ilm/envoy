import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { RichDocument } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

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
  const navigation = useNavigation<any>();
  const [docs, setDocs] = useState<RichDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'documents' | 'templates'>('all');

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

  useFocusEffect(
    useCallback(() => {
      if (ready) refresh();
    }, [ready, refresh])
  );

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
    navigation.navigate('DocumentEditor', { documentId: undefined });
  };

  const openEdit = (d: RichDocument) => {
    navigation.navigate('DocumentEditor', { documentId: d.id });
  };

  const shareDoc = async (d: RichDocument) => {
    const text = d.title ? `${d.title}\n\n${d.content}` : d.content;
    if (!text.trim()) {
      Alert.alert('Document is empty');
      return;
    }
    try {
      await Share.share({ title: d.title || 'Document', message: text });
    } catch (err) {
      console.error('Share failed', err);
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
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>
                  {formatDate(item.updatedAt)}
                  {item.placeholders.length > 0
                    ? ` · ${item.placeholders.length} placeholder${item.placeholders.length === 1 ? '' : 's'}`
                    : ''}
                </Text>
                <TouchableOpacity onPress={() => shareDoc(item)} style={styles.shareButton}>
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          )}
        />
      )}
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
  cardFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: { fontSize: 11, color: '#9ca3af' },
  shareButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  shareButtonText: { color: '#4338ca', fontSize: 11, fontWeight: '600' },
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
