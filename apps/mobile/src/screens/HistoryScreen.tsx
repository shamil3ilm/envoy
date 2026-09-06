import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AuditLog, Channel } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  teams: 'Teams',
  both: 'Any',
};

const STATUS_COLOR: Record<string, string> = {
  sent: '#10b981',
  delivered: '#3b82f6',
  failed: '#dc2626',
  pending: '#f59e0b',
  cancelled: '#6b7280',
};

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

export default function HistoryScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listAuditLogs({ limit: 200 });
      setLogs(rows);
    } catch (err) {
      console.error('Failed to load history', err);
      Alert.alert('Could not load history');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = logs;
    if (channel !== 'all') list = list.filter((l) => l.channel === channel);
    if (q) {
      list = list.filter((l) =>
        `${l.templateName} ${l.recipientName} ${l.recipientAddress} ${l.subject ?? ''}`
          .toLowerCase()
          .includes(q)
      );
    }
    return [...list].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [logs, search, channel]);

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
          placeholder="Search history"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip} contentContainerStyle={styles.chipStripInner}>
        {(['all', 'email', 'whatsapp', 'teams'] as const).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setChannel(c)}
            style={[styles.chip, channel === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, channel === c && styles.chipTextActive]}>
              {c === 'all' ? 'All' : CHANNEL_LABEL[c as Channel]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No history</Text>
          <Text style={styles.emptySubtitle}>Sends and scheduled messages will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_COLOR[item.status] ?? '#9ca3af' },
                ]}
              />
              <View style={styles.rowBody}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowRecipient} numberOfLines={1}>
                    {item.recipientName || item.recipientAddress}
                  </Text>
                  <Text style={styles.rowChannel}>{CHANNEL_LABEL[item.channel]}</Text>
                </View>
                <Text style={styles.rowTemplate} numberOfLines={1}>
                  {item.subject || item.templateName}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatWhen(item.sentAt)} · {item.status}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {selected && (
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Message detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.detailClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailBody}>
              <DetailRow label="Recipient" value={selected.recipientName || selected.recipientAddress} />
              <DetailRow label="Address" value={selected.recipientAddress} />
              <DetailRow label="Channel" value={CHANNEL_LABEL[selected.channel]} />
              <DetailRow label="Template" value={selected.templateName} />
              {selected.subject ? <DetailRow label="Subject" value={selected.subject} /> : null}
              <DetailRow label="Sent at" value={formatWhen(selected.sentAt)} />
              <DetailRow label="Status" value={selected.status} />
              {selected.errorMessage ? (
                <DetailRow label="Error" value={selected.errorMessage} error />
              ) : null}
              <Text style={styles.detailLabel}>Preview</Text>
              <Text style={styles.detailPreview}>{selected.bodyPreview}</Text>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value, error }: { label: string; value: string; error?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, error && styles.detailValueError]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: {
    padding: 12,
    backgroundColor: 'white',
  },
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  rowPressed: { backgroundColor: '#f8fafc' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  rowBody: { flex: 1 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowRecipient: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  rowChannel: { marginLeft: 8, fontSize: 11, color: '#6b7280' },
  rowTemplate: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  rowMeta: { marginTop: 2, fontSize: 11, color: '#9ca3af' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptySubtitle: { marginTop: 8, fontSize: 14, color: '#6b7280', textAlign: 'center' },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'flex-end',
  },
  detailCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  detailTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  detailClose: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  detailBody: { padding: 16 },
  detailRow: { marginBottom: 12 },
  detailLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#111827' },
  detailValueError: { color: '#dc2626' },
  detailPreview: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
});
