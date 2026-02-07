import { useState, useEffect } from 'react';
import { X, Save, User, Plus, Trash2 } from 'lucide-react';
import type { Contact, CreateContactInput, Channel } from '@shared/types';

interface ContactEditorProps {
  contact?: Contact | null;
  onSave: (contact: Contact) => void;
  onClose: () => void;
}

export default function ContactEditor({ contact, onSave, onClose }: ContactEditorProps) {
  const [form, setForm] = useState<CreateContactInput>({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    timezone: '',
    preferredChannel: 'email',
    customFields: {},
    tags: [],
  });
  const [newTag, setNewTag] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        title: contact.title || '',
        timezone: contact.timezone || '',
        preferredChannel: contact.preferredChannel || 'email',
        customFields: contact.customFields || {},
        tags: contact.tags || [],
      });
    }
  }, [contact]);

  const handleAddTag = () => {
    if (newTag.trim() && !form.tags?.includes(newTag.trim())) {
      setForm({
        ...form,
        tags: [...(form.tags || []), newTag.trim()],
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm({
      ...form,
      tags: form.tags?.filter((t) => t !== tag) || [],
    });
  };

  const handleAddCustomField = () => {
    if (newFieldKey.trim() && newFieldValue.trim()) {
      setForm({
        ...form,
        customFields: {
          ...form.customFields,
          [newFieldKey.trim()]: newFieldValue.trim(),
        },
      });
      setNewFieldKey('');
      setNewFieldValue('');
    }
  };

  const handleRemoveCustomField = (key: string) => {
    const newFields = { ...form.customFields };
    delete newFields[key];
    setForm({ ...form, customFields: newFields });
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return undefined;
    const val = email.trim();
    // Must have local@domain.tld format with TLD of 2+ chars, no consecutive dots
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(val)) return 'Invalid email address';
    if (val.includes('..')) return 'Email cannot contain consecutive dots';
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    if (!phone.trim()) return undefined;
    const cleaned = phone.replace(/[\s\-().]/g, '');
    if (!cleaned.startsWith('+')) return 'Phone number must start with country code (e.g. +1, +44)';
    if (!/^\+\d{7,15}$/.test(cleaned)) return 'Invalid phone number (e.g. +1 555 123 4567)';
    return undefined;
  };

  const handleSave = async () => {
    const errors: { email?: string; phone?: string } = {};

    if (!form.name.trim()) {
      setError('Contact name is required');
      return;
    }
    if (!form.email?.trim() && !form.phone?.trim()) {
      setError('At least email or phone is required');
      return;
    }

    if (form.email?.trim()) {
      const emailErr = validateEmail(form.email);
      if (emailErr) errors.email = emailErr;
    }
    if (form.phone?.trim()) {
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) errors.phone = phoneErr;
    }

    if (errors.email || errors.phone) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      let savedContact: Contact;
      if (contact) {
        savedContact = await window.envoy.contacts.update(contact.id, form);
      } else {
        savedContact = await window.envoy.contacts.create(form);
      }
      onSave(savedContact);
    } catch (err) {
      setError('Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const timezones = [
    { value: '', label: 'Select timezone' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Central European (CET)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {contact ? 'Edit Contact' : 'Add Contact'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="John Smith"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  className={`input ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="john@company.com"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                  }}
                  className={`input ${fieldErrors.phone ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="+1 555 123 4567"
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Company & Title */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="input"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  placeholder="CEO"
                />
              </div>
            </div>

            {/* Timezone & Channel */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Timezone
                </label>
                <select
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="input"
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Channel
                </label>
                <select
                  value={form.preferredChannel}
                  onChange={(e) => setForm({ ...form, preferredChannel: e.target.value as Channel })}
                  className="input"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-primary-100 dark:bg-[var(--primary-tint-30)] text-primary-700 dark:text-primary-400 rounded text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-primary-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="input flex-1"
                  placeholder="Add a tag"
                />
                <button onClick={handleAddTag} className="btn btn-secondary">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Custom Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Fields
              </label>
              <div className="space-y-2 mb-2">
                {Object.entries(form.customFields || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300 min-w-[100px]">
                      {key}:
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                      {value}
                    </span>
                    <button
                      onClick={() => handleRemoveCustomField(key)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="input w-1/3"
                  placeholder="Field name"
                />
                <input
                  type="text"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomField())}
                  className="input flex-1"
                  placeholder="Value"
                />
                <button onClick={handleAddCustomField} className="btn btn-secondary">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use in templates as {'{{ custom.field_name }}'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
