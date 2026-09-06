import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { UserActivityLog, ActivityCategory } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

const CATEGORY_EMOJI: Record<ActivityCategory, string> = {
  template: '📝',
  contact: '👥',
  email: '✉️',
  document: '📄',
  settings: '⚙️',
  system: '🖥️',
  schedule: '📅',
  reminder: '🔔',
  task: '✅',
  note: '📒',
  snippet: '✂️',
  expense: '💰',
};

const CATEGORY_COLOR: Record<ActivityCategory, string> = {
  template: '#8b5cf6',
  contact: '#3b82f6',
  email: '#10b981',
  document: '#f97316',
  settings: '#6b7280',
  system: '#dc2626',
  schedule: '#6366f1',
  reminder: '#eab308',
  task: '#14b8a6',
  note: '#84cc16',
  snippet: '#ec4899',
  expense: '#f59e0b',
};

const FILTERS: (ActivityCategory | 'all')[] = [
  'all',
  'contact',
  'template',
  'email',
  'task',
  'note',
  'reminder',
  'schedule',
];

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ActivityLogScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [logs, setLogs] = useState<UserActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!db) return;
    try {
      const { logs: rows, total } = await db.listActivityLogs({ limit: 200 });
      const scoped = category === 'all' ? rows : rows.filter((r) => r.category === category);
      setLogs(scoped);
      setTotal(total);
    } catch (err) {
      console.error('Failed to load activity', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, category]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.action} ${l.description} ${l.entityName ?? ''}`.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

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
          placeholder="Search activity"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chipStripInner}
      >
        {FILTERS.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
              {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No activity</Text>
          <Text style={styles.emptySubtitle}>Actions in the app will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: (CATEGORY_COLOR[item.category] ?? '#6b7280') + '22' },
                ]}
              >
                <Text style={styles.iconText}>{CATEGORY_EMOJI[item.category] ?? '•'}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatWhen(item.createdAt)}
                  {item.entityName ? ` · ${item.entityName}` : ''}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            total > filtered.length ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Showing {filtered.length} of {total}</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: { padding: 12, backgroundColor: 'white' },
  search: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontSize: 15,
  },
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
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 16 },
  rowBody: { flex: 1 },
  rowDescription: { fontSize: 14, color: '#111827' },
  rowMeta: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptySubtitle: { marginTop: 8, fontSize: 14, color: '#6b7280', textAlign: 'center' },
  footer: { alignItems: 'center', padding: 16 },
  footerText: { fontSize: 12, color: '#9ca3af' },
});
