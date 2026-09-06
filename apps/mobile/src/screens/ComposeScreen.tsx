import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
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
import type { Contact, Template, Channel } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';
import { renderTemplate } from '../services/TemplateEngine';

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  teams: 'Teams',
  both: 'Any',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

function sanitizePhone(raw: string): string | null {
  const trimmed = raw.replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{6,20}$/.test(trimmed) ? trimmed : null;
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

export default function ComposeScreen() {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [channel, setChannel] = useState<Channel>('email');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [bodyOverride, setBodyOverride] = useState('');
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState<'template' | 'contact' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [ts, cs] = await Promise.all([db.listTemplates(), db.listContacts()]);
      setTemplates(ts);
      setContacts(cs);
    } catch (err) {
      console.error('Failed to load compose data', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  useEffect(() => {
    if (template) {
      setSubjectOverride(template.subject ?? '');
      setBodyOverride(template.body);
      if (template.channel !== 'both') setChannel(template.channel);
    }
  }, [template]);

  const rendered = useMemo(() => {
    const data = buildContext(contact);
    const subjectResult = subjectOverride
      ? renderTemplate(subjectOverride, data)
      : { success: true, rendered: '' };
    const bodyResult = bodyOverride
      ? renderTemplate(bodyOverride, data)
      : { success: true, rendered: '' };
    return {
      subject: subjectResult.success ? subjectResult.rendered ?? '' : subjectOverride,
      body: bodyResult.success ? bodyResult.rendered ?? '' : bodyOverride,
      error: subjectResult.error || bodyResult.error,
    };
  }, [contact, subjectOverride, bodyOverride]);

  const filteredPicker = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (pickerOpen === 'template') {
      const list = templates.filter((t) =>
        !q || `${t.name} ${t.category} ${t.subject ?? ''}`.toLowerCase().includes(q)
      );
      return list;
    }
    if (pickerOpen === 'contact') {
      const list = contacts.filter((c) =>
        !q || `${c.name} ${c.email ?? ''} ${c.phone ?? ''} ${c.company ?? ''}`.toLowerCase().includes(q)
      );
      return list;
    }
    return [];
  }, [pickerOpen, pickerSearch, templates, contacts]);

  const openPicker = (mode: 'template' | 'contact') => {
    setPickerSearch('');
    setPickerOpen(mode);
  };

  const send = async () => {
    if (!contact) {
      Alert.alert('Pick a recipient first');
      return;
    }
    if (!rendered.body.trim()) {
      Alert.alert('Message body is empty');
      return;
    }

    let url: string | null = null;
    let missing: string | null = null;

    if (channel === 'email') {
      if (!contact.email) missing = 'email address';
      else {
        const subject = encodeURIComponent(rendered.subject.slice(0, 998));
        const body = encodeURIComponent(rendered.body.slice(0, 20000));
        url = `mailto:${encodeURIComponent(contact.email)}?subject=${subject}&body=${body}`;
      }
    } else if (channel === 'whatsapp') {
      const phone = contact.phone ? sanitizePhone(contact.phone) : null;
      if (!phone) missing = 'phone number';
      else {
        const message = encodeURIComponent(rendered.body.slice(0, 4000));
        url = `https://wa.me/${encodeURIComponent(phone)}?text=${message}`;
      }
    } else if (channel === 'teams') {
      if (!contact.email) missing = 'email address';
      else {
        const message = encodeURIComponent(rendered.body.slice(0, 4000));
        url = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(contact.email)}&message=${message}`;
      }
    }

    if (missing) {
      Alert.alert(`This contact has no ${missing} for the selected channel`);
      return;
    }
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('No app installed to handle this channel');
        return;
      }
      await Linking.openURL(url);

      if (db && template) {
        try {
          await db.createAuditLog({
            channel,
            templateId: template.id,
            templateName: template.name,
            recipientId: contact.id,
            recipientName: contact.name,
            recipientAddress: channel === 'whatsapp' ? contact.phone ?? '' : contact.email ?? '',
            subject: channel === 'email' ? rendered.subject : undefined,
            bodyPreview: rendered.body.slice(0, 200),
            attachments: [],
            status: 'sent',
            sentAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('createAuditLog failed', err);
        }

        try {
          await db.updateContactLastContacted(contact.id);
        } catch (err) {
          console.error('updateContactLastContacted failed', err);
        }
      }
      Toast.show({ type: 'success', text1: 'Handed off to the app' });
    } catch (err) {
      console.error('Send failed', err);
      Alert.alert('Could not open the target app');
    }
  };

  const copy = () => {
    const text = rendered.subject
      ? `${rendered.subject}\n\n${rendered.body}`
      : rendered.body;
    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
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
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>Template</Text>
        <Pressable style={styles.picker} onPress={() => openPicker('template')}>
          <Text style={template ? styles.pickerValue : styles.pickerPlaceholder} numberOfLines={1}>
            {template ? template.name : 'Pick a template'}
          </Text>
          <Text style={styles.pickerHint}>›</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Recipient</Text>
        <Pressable style={styles.picker} onPress={() => openPicker('contact')}>
          <Text style={contact ? styles.pickerValue : styles.pickerPlaceholder} numberOfLines={1}>
            {contact ? contact.name : 'Pick a contact'}
          </Text>
          <Text style={styles.pickerHint}>›</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Channel</Text>
        <View style={styles.chipRow}>
          {(['email', 'whatsapp', 'teams'] as Channel[]).map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setChannel(c)}
              style={[styles.chip, channel === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, channel === c && styles.chipTextActive]}>
                {CHANNEL_LABEL[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(channel === 'email') && (
          <>
            <Text style={styles.sectionLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subjectOverride}
              onChangeText={setSubjectOverride}
              placeholder="Subject"
              placeholderTextColor="#9ca3af"
            />
          </>
        )}

        <Text style={styles.sectionLabel}>Body</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={bodyOverride}
          onChangeText={setBodyOverride}
          placeholder="Message body"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
        />

        {contact && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Preview (rendered for {contact.name})</Text>
            {channel === 'email' && rendered.subject ? (
              <Text style={styles.previewSubject}>{rendered.subject}</Text>
            ) : null}
            <Text style={styles.previewBody}>{rendered.body}</Text>
            {rendered.error ? <Text style={styles.previewError}>{rendered.error}</Text> : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={copy}>
          <Text style={styles.secondaryButtonText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={send}>
          <Text style={styles.primaryButtonText}>Open in {CHANNEL_LABEL[channel]}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={pickerOpen !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPickerOpen(null)}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {pickerOpen === 'template' ? 'Pick template' : 'Pick contact'}
            </Text>
            <View style={{ width: 50 }} />
          </View>
          <TextInput
            style={styles.pickerSearch}
            placeholder="Search"
            placeholderTextColor="#9ca3af"
            value={pickerSearch}
            onChangeText={setPickerSearch}
            autoCorrect={false}
          />
          <ScrollView>
            {filteredPicker.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {pickerOpen === 'template' ? 'No templates' : 'No contacts'}
                </Text>
              </View>
            ) : (
              filteredPicker.map((item) => {
                if (pickerOpen === 'template') {
                  const t = item as Template;
                  return (
                    <Pressable
                      key={t.id}
                      style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
                      onPress={() => {
                        setTemplate(t);
                        setPickerOpen(null);
                      }}
                    >
                      <Text style={styles.pickerRowTitle}>{t.name}</Text>
                      <Text style={styles.pickerRowSub} numberOfLines={1}>
                        {t.subject || t.body.slice(0, 80)}
                      </Text>
                    </Pressable>
                  );
                } else {
                  const c = item as Contact;
                  return (
                    <Pressable
                      key={c.id}
                      style={({ pressed }) => [styles.pickerRow, pressed && styles.rowPressed]}
                      onPress={() => {
                        setContact(c);
                        setPickerOpen(null);
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
                  );
                }
              })
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
  body: { padding: 16, paddingBottom: 100 },
  sectionLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  pickerValue: { flex: 1, fontSize: 15, color: '#111827' },
  pickerPlaceholder: { flex: 1, fontSize: 15, color: '#9ca3af' },
  pickerHint: { fontSize: 20, color: '#9ca3af' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    marginBottom: 6,
  },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#4b5563' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  input: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  textarea: { minHeight: 180, paddingTop: 12, textAlignVertical: 'top' },
  preview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
  },
  previewLabel: { fontSize: 11, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  previewSubject: { fontSize: 14, fontWeight: '600', color: '#1e1b4b', marginBottom: 6 },
  previewBody: { fontSize: 13, color: '#1e1b4b', lineHeight: 20 },
  previewError: { marginTop: 8, fontSize: 12, color: '#dc2626' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'white',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  primaryButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#374151', fontWeight: '600', fontSize: 15 },
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
  rowPressed: { backgroundColor: '#f8fafc' },
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
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 15, color: '#6b7280' },
});
