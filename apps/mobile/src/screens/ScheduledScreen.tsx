import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ScheduledMessage, ScheduleStatus, Template, Contact, Channel } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<ScheduleStatus, string> = {
  pending: '#f59e0b',
  sent: '#10b981',
  failed: '#dc2626',
  cancelled: '#6b7280',
};

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  teams: 'Teams',
  both: 'Any',
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const minutes = Math.round(abs / 60000);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    if (abs < 60_000) return diff > 0 ? 'now' : 'just now';
    if (minutes < 60) return diff > 0 ? `in ${minutes}m` : `${minutes}m ago`;
    if (hours < 24) return diff > 0 ? `in ${hours}h` : `${hours}h ago`;
    if (days < 7) return diff > 0 ? `in ${days}d` : `${days}d ago`;
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ScheduledScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ScheduleStatus | 'all'>('pending');

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [msgs, ts, cs] = await Promise.all([
        db.listScheduledMessages(),
        db.listTemplates(),
        db.listContacts(),
      ]);
      setMessages(msgs);
      const tMap: Record<string, Template> = {};
      for (const t of ts) tMap[t.id] = t;
      setTemplates(tMap);
      const cMap: Record<string, Contact> = {};
      for (const c of cs) cMap[c.id] = c;
      setContacts(cMap);
    } catch (err) {
      console.error('Failed to load scheduled', err);
      Alert.alert('Could not load scheduled messages');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const list = status === 'all' ? messages : messages.filter((m) => m.status === status);
    return [...list].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }, [messages, status]);

  const cancel = (m: ScheduledMessage) => {
    Alert.alert('Cancel this scheduled message?', 'It will not be sent.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel it',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.updateScheduledMessage(m.id, { status: 'cancelled' });
            await refresh();
          } catch (err) {
            console.error('Cancel scheduled failed', err);
          }
        },
      },
    ]);
  };

  const confirmDelete = (m: ScheduledMessage) => {
    Alert.alert('Delete this record?', 'Removes the scheduled row entirely.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteScheduledMessage(m.id);
            await refresh();
          } catch (err) {
            console.error('Delete scheduled failed', err);
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chipStripInner}
      >
        {(['all', 'pending', 'sent', 'failed', 'cancelled'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatus(s)}
            style={[styles.chip, status === s && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Mobile can’t auto-send in the background yet. Use the desktop app for delivery, or send manually from Compose.
        </Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nothing scheduled</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const template = templates[item.templateId];
            const firstRecipient = contacts[item.recipientIds[0]];
            const extra = item.recipientIds.length - 1;
            return (
              <Pressable
                onLongPress={() => confirmDelete(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {template ? template.name : 'Template deleted'}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    To {firstRecipient ? firstRecipient.name : 'unknown'}
                    {extra > 0 ? ` +${extra} more` : ''} · {CHANNEL_LABEL[item.channel]}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatWhen(item.scheduledFor)} · {STATUS_LABEL[item.status]}
                    {item.errorMessage ? ` · ${item.errorMessage}` : ''}
                  </Text>
                </View>
                {item.status === 'pending' && (
                  <TouchableOpacity onPress={() => cancel(item)} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  chipStrip: {
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    maxHeight: 52,
    paddingVertical: 8,
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
  hint: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
  },
  hintText: { fontSize: 12, color: '#78350f', lineHeight: 16 },
  list: { paddingVertical: 8 },
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
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { marginTop: 2, fontSize: 13, color: '#4b5563' },
  rowMeta: { marginTop: 2, fontSize: 11, color: '#9ca3af' },
  actionButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  actionButtonText: { color: '#dc2626', fontWeight: '600', fontSize: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
});
