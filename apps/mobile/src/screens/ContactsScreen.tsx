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
import type { Contact, CreateContactInput } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  tags: string;
}

const EMPTY_FORM: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  title: '',
  tags: '',
};

function contactToForm(contact: Contact): ContactFormState {
  return {
    name: contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: contact.company ?? '',
    title: contact.title ?? '',
    tags: contact.tags.join(', '),
  };
}

function formToInput(form: ContactFormState): CreateContactInput {
  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    name: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    company: form.company.trim() || undefined,
    title: form.title.trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export default function ContactsScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const rows = await db.listContacts();
      setContacts(rows);
    } catch (err) {
      console.error('Failed to load contacts', err);
      Alert.alert('Could not load contacts');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const hay = `${c.name} ${c.email ?? ''} ${c.phone ?? ''} ${c.company ?? ''} ${c.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setForm(contactToForm(contact));
    setFormOpen(true);
  };

  const save = async () => {
    if (!db) return;
    const input = formToInput(form);
    if (!input.name) {
      Alert.alert('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await db.updateContact(editing.id, input);
      } else {
        await db.createContact(input);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      console.error('Save contact failed', err);
      Alert.alert('Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (contact: Contact) => {
    Alert.alert(
      'Delete contact?',
      `${contact.name} will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!db) return;
            try {
              await db.deleteContact(contact.id);
              await refresh();
            } catch (err) {
              console.error('Delete contact failed', err);
              Alert.alert('Could not delete contact');
            }
          },
        },
      ]
    );
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
          placeholder="Search contacts"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {contacts.length === 0 ? 'No contacts yet' : 'No matches'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {contacts.length === 0
              ? 'Tap “+ Add” to create your first contact.'
              : 'Try a different search term.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                {(item.email || item.phone) && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.email || item.phone}
                  </Text>
                )}
                {item.company && (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.company}
                    {item.title ? ` · ${item.title}` : ''}
                  </Text>
                )}
              </View>
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
            <Text style={styles.modalTitle}>
              {editing ? 'Edit contact' : 'New contact'}
            </Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <FormField
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <FormField
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              keyboardType="phone-pad"
            />
            <FormField
              label="Company"
              value={form.company}
              onChange={(v) => setForm({ ...form, company: v })}
            />
            <FormField
              label="Title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
            />
            <FormField
              label="Tags (comma-separated)"
              value={form.tags}
              onChange={(v) => setForm({ ...form, tags: v })}
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
                <Text style={styles.deleteButtonText}>Delete contact</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}

function FormField({
  label,
  value,
  onChange,
  required,
  keyboardType,
  autoCapitalize,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.fieldRequired}> *</Text>}
      </Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        placeholderTextColor="#9ca3af"
      />
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
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
  },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#4338ca', fontWeight: '700', fontSize: 15 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  rowSub: { marginTop: 2, fontSize: 13, color: '#4b5563' },
  rowMeta: { marginTop: 2, fontSize: 12, color: '#9ca3af' },
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
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: '500' },
  fieldRequired: { color: '#dc2626' },
  fieldInput: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
  },
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
