import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Reminder, Task, ScheduledMessage, AuditLog } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

interface DashboardStats {
  contacts: number;
  templates: number;
  tasks: number;
  openReminders: number;
  scheduledPending: number;
  sentToday: number;
}

const EMPTY_STATS: DashboardStats = {
  contacts: 0,
  templates: 0,
  tasks: 0,
  openReminders: 0,
  scheduledPending: 0,
  sentToday: 0,
};

interface QuickAction {
  emoji: string;
  label: string;
  screen: string;
  parent?: string;
}

const ACTIONS: QuickAction[] = [
  { emoji: '✏️', label: 'Compose', screen: 'Compose', parent: 'CommTab' },
  { emoji: '👥', label: 'Contacts', screen: 'Contacts', parent: 'ContentTab' },
  { emoji: '📝', label: 'Templates', screen: 'Templates', parent: 'ContentTab' },
  { emoji: '✅', label: 'Tasks', screen: 'Tasks', parent: 'ProductivityTab' },
  { emoji: '🔔', label: 'Reminders', screen: 'Reminders', parent: 'ProductivityTab' },
  { emoji: '💰', label: 'Expenses', screen: 'Expenses', parent: 'ProductivityTab' },
];

function formatDueSoon(iso: string): string {
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

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [upcomingReminders, setUpcomingReminders] = useState<Reminder[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [recentSends, setRecentSends] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    try {
      const [contacts, templates, tasks, reminders, scheduled, history] = await Promise.all([
        db.listContacts(),
        db.listTemplates(),
        db.listTasks(),
        db.listReminders(),
        db.listScheduledMessages({ status: 'pending' }),
        db.listAuditLogs({ limit: 50 }),
      ]);

      const today = new Date().toISOString().slice(0, 10);

      setStats({
        contacts: contacts.length,
        templates: templates.length,
        tasks: tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').length,
        openReminders: reminders.filter((r) => r.status === 'pending').length,
        scheduledPending: (scheduled as ScheduledMessage[]).length,
        sentToday: history.filter((h) => h.sentAt.slice(0, 10) === today).length,
      });

      setUpcomingReminders(
        reminders
          .filter((r) => r.status === 'pending')
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
          .slice(0, 3)
      );

      setDueTasks(
        tasks
          .filter((t) => t.status !== 'done' && t.status !== 'archived')
          .sort((a, b) => {
            const ap = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2;
            const bp = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2;
            if (ap !== bp) return ap - bp;
            return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
          })
          .slice(0, 3)
      );

      setRecentSends(history.slice(0, 4));
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  const navigateAction = (action: QuickAction) => {
    if (action.parent) {
      navigation.navigate(action.parent, { screen: action.screen });
    } else {
      navigation.navigate(action.screen);
    }
  };

  if (!ready || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.greetingBlock}>
        <Text style={styles.greetingHello}>{greeting()}</Text>
        <Text style={styles.greetingSummary}>
          {stats.openReminders > 0
            ? `${stats.openReminders} reminder${stats.openReminders === 1 ? '' : 's'} waiting`
            : 'Inbox looks clean.'}
          {stats.scheduledPending > 0 ? ` · ${stats.scheduledPending} scheduled` : ''}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Contacts" value={stats.contacts} color="#3b82f6" />
        <StatCard label="Templates" value={stats.templates} color="#8b5cf6" />
        <StatCard label="Open tasks" value={stats.tasks} color="#f97316" />
        <StatCard label="Sent today" value={stats.sentToday} color="#10b981" />
      </View>

      <SectionHeader title="Quick actions" />
      <View style={styles.actionGrid}>
        {ACTIONS.map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => navigateAction(a)}>
            <Text style={styles.actionEmoji}>{a.emoji}</Text>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {upcomingReminders.length > 0 && (
        <>
          <SectionHeader
            title="Upcoming reminders"
            onSeeAll={() => navigation.navigate('ProductivityTab', { screen: 'Reminders' })}
          />
          {upcomingReminders.map((r) => (
            <ListRow
              key={r.id}
              emoji="🔔"
              title={r.title}
              subtitle={`${formatDueSoon(r.dueAt)}${r.description ? ` · ${r.description}` : ''}`}
            />
          ))}
        </>
      )}

      {dueTasks.length > 0 && (
        <>
          <SectionHeader
            title="Priority tasks"
            onSeeAll={() => navigation.navigate('ProductivityTab', { screen: 'Tasks' })}
          />
          {dueTasks.map((t) => (
            <ListRow
              key={t.id}
              emoji={t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟠' : '⚪'}
              title={t.title}
              subtitle={t.description || t.status.replace('_', ' ')}
            />
          ))}
        </>
      )}

      {recentSends.length > 0 && (
        <>
          <SectionHeader
            title="Recent sends"
            onSeeAll={() => navigation.navigate('CommTab', { screen: 'History' })}
          />
          {recentSends.map((h) => (
            <ListRow
              key={h.id}
              emoji={h.channel === 'email' ? '✉️' : h.channel === 'whatsapp' ? '💬' : '👥'}
              title={h.recipientName || h.recipientAddress}
              subtitle={`${h.templateName} · ${formatDueSoon(h.sentAt)}`}
            />
          ))}
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Envoy Mobile</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.sectionAction}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ListRow({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <View style={styles.listRow}>
      <Text style={styles.listEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.listSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
    </View>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  greetingBlock: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  greetingHello: { fontSize: 22, fontWeight: '700', color: '#111827' },
  greetingSummary: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  statCard: {
    width: '50%',
    padding: 6,
  },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionAction: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  actionCard: {
    width: '33.333%',
    padding: 6,
    alignItems: 'center',
  },
  actionEmoji: { fontSize: 28, marginBottom: 4 },
  actionLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  listEmoji: { fontSize: 20, marginRight: 12 },
  listTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  listSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  footer: { alignItems: 'center', paddingVertical: 32 },
  footerText: { fontSize: 12, color: '#9ca3af' },
});
