import { useState, useEffect } from 'react';
import { X, Save, Eye, FileText } from 'lucide-react';
import type { Template, CreateTemplateInput, TemplateCategory } from '@shared/types';
import { TEMPLATE_CATEGORIES, TEMPLATE_PLACEHOLDERS, PLACEHOLDER_GROUPS } from '@shared/constants';
import type { PlaceholderGroup } from '@shared/types';
import { useSettings } from '../../contexts/SettingsContext';

interface TemplateEditorProps {
  template?: Template | null;
  onSave: (template: Template) => void;
  onClose: () => void;
}

export default function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const { settings } = useSettings();
  const [form, setForm] = useState<CreateTemplateInput>({
    name: '',
    category: 'greeting',
    channel: 'email' as const,
    subject: '',
    body: '',
    tone: 'professional',
  });
  const [preview, setPreview] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build sample data from saved placeholder defaults + fallbacks
  const sampleData = (() => {
    const defaults: Record<string, string> = {};
    const savedDefaults = settings.preferences?.placeholders?.defaults || [];
    for (const ph of savedDefaults) {
      if (ph.defaultValue) defaults[ph.key] = ph.defaultValue;
    }
    return {
      name: defaults.name || 'John Smith',
      first_name: defaults.first_name || 'John',
      last_name: defaults.last_name || 'Smith',
      company: defaults.company || 'Acme Corp',
      title: defaults.title || 'CEO',
      date: defaults.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: defaults.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      sender_name: defaults.sender_name || settings.profile?.name || 'Your Name',
      sender_title: defaults.sender_title || 'Your Title',
      signature: (() => {
        const sigs = settings.profile?.signatures || [];
        const defaultSig = sigs.find(s => s.id === settings.profile?.defaultSignatureId) || sigs[0];
        return defaultSig
          ? `<img src="${defaultSig.dataUrl}" style="max-height:60px" alt="Signature" />`
          : '[No signature set]';
      })(),
      // Include any custom placeholder defaults
      ...Object.fromEntries(
        savedDefaults
          .filter((d) => d.group === 'custom' && d.defaultValue)
          .map((d) => [d.key, d.defaultValue])
      ),
    };
  })();

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name,
        category: template.category,
        channel: template.channel,
        subject: template.subject || '',
        body: template.body,
        tone: template.tone,
        attachmentTemplate: template.attachmentTemplate,
        attachmentFormat: template.attachmentFormat,
        followUpDays: template.followUpDays,
      });
    }
  }, [template]);

  const handlePreview = async () => {
    try {
      const result = await window.envoy.templates.render(form.body, sampleData);
      if (result.success && result.rendered) {
        setPreview(result.rendered);
        setShowPreview(true);
      } else {
        setError(result.error || 'Failed to render preview');
      }
    } catch (err) {
      setError('Failed to generate preview');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!form.body.trim()) {
      setError('Template body is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let savedTemplate: Template;
      if (template) {
        savedTemplate = await window.envoy.templates.update(template.id, form);
      } else {
        savedTemplate = await window.envoy.templates.create(form);
      }
      onSave(savedTemplate);
    } catch (err) {
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.body;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = `${before}{{ ${placeholder} }}${after}`;
      setForm({ ...form, body: newText });

      // Restore cursor position after the placeholder
      setTimeout(() => {
        textarea.focus();
        const newPos = start + placeholder.length + 6; // {{ placeholder }}
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {template ? 'Edit Template' : 'Create Template'}
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

          <div className="grid grid-cols-2 gap-6">
            {/* Left column - Form */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Formal Greeting"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}
                  className="input"
                >
                  {Object.entries(TEMPLATE_CATEGORIES).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="input"
                  placeholder="e.g., Greetings from {{ sender_name }}"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message Body *
                </label>
                <textarea
                  id="template-body"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="input min-h-[200px] font-mono text-sm"
                  placeholder="Dear {{ name }},&#10;&#10;Your message here...&#10;&#10;Best regards,&#10;{{ sender_name }}"
                />
              </div>

              {/* Follow-up days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Suggest Follow-up After (days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={form.followUpDays || ''}
                  onChange={(e) => setForm({ ...form, followUpDays: parseInt(e.target.value) || undefined })}
                  className="input w-24"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Right column - Placeholders & Preview */}
            <div className="space-y-4">
              {/* Placeholders (grouped) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Available Placeholders
                </label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-3 max-h-[350px] overflow-y-auto">
                  {(Object.entries(PLACEHOLDER_GROUPS) as [PlaceholderGroup, { label: string }][]).map(([groupKey, groupInfo]) => {
                    const builtIn = TEMPLATE_PLACEHOLDERS.filter((p) => p.group === groupKey);
                    const custom = (settings.preferences?.placeholders?.defaults || [])
                      .filter((p) => p.group === groupKey && !p.isBuiltIn);
                    const allItems = [
                      ...builtIn.map((p) => ({ key: p.key, description: p.description })),
                      ...custom.map((p) => ({ key: p.key, description: p.label })),
                    ];
                    if (allItems.length === 0) return null;

                    return (
                      <div key={groupKey}>
                        <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-1">
                          {groupInfo.label}
                        </div>
                        <div className="space-y-0.5">
                          {allItems.map((p) => (
                            <button
                              key={p.key}
                              onClick={() => insertPlaceholder(p.key)}
                              className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <code className="text-xs text-primary-600 dark:text-primary-400 font-mono">
                                {'{{ ' + p.key + ' }}'}
                              </code>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 truncate">{p.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Click to insert at cursor. Manage placeholders in Settings.
                </p>
              </div>

              {/* Preview Panel */}
              {showPreview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview
                  </label>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    {form.subject && (
                      <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Subject:</span>
                        <div className="font-medium">{form.subject}</div>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm">{preview}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button
            onClick={handlePreview}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
