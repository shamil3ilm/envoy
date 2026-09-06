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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Expense, CreateExpenseInput, ExpenseSummary } from '@envoy/shared';
import { EXPENSE_CATEGORIES } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES;
const CATEGORIES = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategoryKey[];

interface ExpenseFormState {
  amount: string;
  currency: string;
  category: string;
  description: string;
  date: string;
  tags: string;
}

const EMPTY_FORM: ExpenseFormState = {
  amount: '',
  currency: 'USD',
  category: 'other',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  tags: '',
};

function expenseToForm(e: Expense): ExpenseFormState {
  return {
    amount: String(e.amount),
    currency: e.currency,
    category: e.category,
    description: e.description,
    date: e.date.slice(0, 10),
    tags: e.tags.join(', '),
  };
}

function formToInput(f: ExpenseFormState): CreateExpenseInput | null {
  const amount = parseFloat(f.amount);
  if (isNaN(amount) || amount <= 0) return null;
  if (!f.description.trim() || !f.date) return null;
  const tags = f.tags.split(',').map((t) => t.trim()).filter(Boolean);
  return {
    amount,
    currency: f.currency.trim() || 'USD',
    category: f.category,
    description: f.description.trim(),
    date: f.date,
    tags: tags.length > 0 ? tags : undefined,
  };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function firstOfMonth(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
}

function lastOfMonth(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${(last.getMonth() + 1).toString().padStart(2, '0')}-${last.getDate().toString().padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function ExpensesScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthDate, setMonthDate] = useState(new Date());
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const fromDate = firstOfMonth(monthDate);
      const toDate = lastOfMonth(monthDate);
      const [rows, s] = await Promise.all([
        db.listExpenses({ fromDate, toDate }),
        db.getExpenseSummary({ fromDate, toDate }),
      ]);
      setExpenses(rows);
      setSummary(s);
    } catch (err) {
      console.error('Failed to load expenses', err);
      Alert.alert('Could not load expenses');
    } finally {
      setLoading(false);
    }
  }, [db, monthDate]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  );

  const currency = expenses[0]?.currency || 'USD';

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm(expenseToForm(e));
    setFormOpen(true);
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input) {
      Alert.alert('Amount, description, and date are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateExpense(editing.id, input);
      } else {
        await db.createExpense(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save expense failed', err);
      Alert.alert('Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (e: Expense) => {
    Alert.alert('Delete expense?', e.description, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await db.deleteExpense(e.id);
            await refresh();
          } catch (err) {
            console.error('Delete expense failed', err);
          }
        },
      },
    ]);
  };

  const prevMonth = () => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() - 1);
    setMonthDate(d);
  };

  const nextMonth = () => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + 1);
    setMonthDate(d);
  };

  if (!ready || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const topCategories =
    summary?.byCategory
      ? Object.entries(summary.byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
      : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(monthDate)}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total this month</Text>
          <Text style={styles.summaryValue}>{formatMoney(summary.total, currency)}</Text>
          {topCategories.length > 0 && (
            <View style={styles.summaryPills}>
              {topCategories.map(([cat, amt]) => {
                const meta = EXPENSE_CATEGORIES[cat as ExpenseCategoryKey];
                return (
                  <View
                    key={cat}
                    style={[styles.summaryPill, { backgroundColor: (meta?.color ?? '#6b7280') + '22' }]}
                  >
                    <Text style={[styles.summaryPillText, { color: meta?.color ?? '#6b7280' }]}>
                      {meta?.label ?? cat}: {formatMoney(amt, currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No expenses</Text>
          <Text style={styles.emptySubtitle}>Tap “+” to log one.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = EXPENSE_CATEGORIES[item.category as ExpenseCategoryKey];
            return (
              <Pressable
                onPress={() => openEdit(item)}
                onLongPress={() => confirmDelete(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.categoryDot, { backgroundColor: meta?.color ?? '#6b7280' }]} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {meta?.label ?? item.category} · {item.date.slice(0, 10)}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{formatMoney(item.amount, item.currency)}</Text>
              </Pressable>
            );
          }}
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
            <Text style={styles.modalTitle}>{editing ? 'Edit expense' : 'New expense'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <View style={styles.amountRow}>
              <View style={styles.currencyBox}>
                <Text style={styles.fieldLabel}>Currency</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.currency}
                  onChangeText={(v) => setForm({ ...form, currency: v.toUpperCase() })}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.amount}
                  onChangeText={(v) => setForm({ ...form, amount: v })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
            />
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.date}
              onChangeText={(v) => setForm({ ...form, date: v })}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const meta = EXPENSE_CATEGORIES[c];
                const active = form.category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setForm({ ...form, category: c })}
                    style={[
                      styles.chip,
                      active && { backgroundColor: meta.color },
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.tags}
              onChangeText={(v) => setForm({ ...form, tags: v })}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {editing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setFormOpen(false);
                  confirmDelete(editing);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete expense</Text>
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
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  navButtonText: { fontSize: 20, color: '#374151', lineHeight: 22 },
  monthLabel: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontSize: 22, lineHeight: 24, fontWeight: '600' },
  summary: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  summaryLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 4 },
  summaryPills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  summaryPillText: { fontSize: 12, fontWeight: '600' },
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
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  rowBody: { flex: 1 },
  rowDesc: { fontSize: 15, color: '#111827', fontWeight: '500' },
  rowMeta: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  rowAmount: { fontSize: 15, fontWeight: '600', color: '#111827', marginLeft: 12 },
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
  amountRow: { flexDirection: 'row', gap: 12 },
  currencyBox: { width: 96 },
  amountBox: { flex: 1 },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: { fontSize: 13, color: '#4b5563' },
  chipTextActive: { color: 'white', fontWeight: '600' },
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
