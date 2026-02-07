import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Zap,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Hash,
} from 'lucide-react';
import type { Snippet, SnippetCategory } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useUserProfiles } from '../hooks/useUserProfiles';
import { useActivityLog } from '../hooks/useActivityLog';

const CATEGORY_OPTIONS: { value: SnippetCategory; label: string; description: string }[] = [
  { value: 'greeting', label: 'Greeting', description: 'Opening lines' },
  { value: 'closing', label: 'Closing', description: 'Sign-offs' },
  { value: 'signature', label: 'Signature', description: 'Email signatures' },
  { value: 'paragraph', label: 'Paragraph', description: 'Text blocks' },
  { value: 'custom', label: 'Custom', description: 'Other' },
];

export default function Snippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SnippetCategory | ''>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();
  const { suggestedSnippets } = useUserProfiles();
  const { logSnippetCreated, logSnippetUpdated, logSnippetDeleted } = useActivityLog();

  useEffect(() => {
    loadSnippets();
  }, []);

  async function loadSnippets() {
    try {
      setLoading(true);
      const data = await window.envoy.snippets.list();
      setSnippets(data);
    } catch (error) {
      console.error('Failed to load snippets:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSnippets = snippets.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      s.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreateSnippet = () => {
    setEditingSnippet(null);
    setShowEditor(true);
  };

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setShowEditor(true);
    setOpenMenuId(null);
  };

  const handleDeleteSnippet = async (snippet: Snippet) => {
    if (deletingId) return;
    if (!confirm(`Delete "${snippet.name}"?`)) return;
    setDeletingId(snippet.id);
    try {
      await window.envoy.snippets.delete(snippet.id);
      setSnippets(snippets.filter((s) => s.id !== snippet.id));
      toast.success('Snippet deleted', `"${snippet.name}" has been removed`);
      logSnippetDeleted(snippet.id, snippet.name);
    } catch (error) {
      console.error('Failed to delete snippet:', error);
      toast.error('Delete failed', 'Could not delete the snippet');
    } finally {
      setDeletingId(null);
    }
    setOpenMenuId(null);
  };

  const handleCopySnippet = async (snippet: Snippet) => {
    try {
      await navigator.clipboard.writeText(snippet.content);
      await window.envoy.snippets.incrementUsage(snippet.id);
      setSnippets(
        snippets.map((s) =>
          s.id === snippet.id ? { ...s, usageCount: s.usageCount + 1 } : s
        )
      );
      toast.success('Copied to clipboard', `"${snippet.name}" is ready to paste`);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Copy failed', 'Could not copy to clipboard');
    }
    setOpenMenuId(null);
  };

  const handleSaveSnippet = async (data: {
    name: string;
    shortcut: string;
    content: string;
    category: SnippetCategory;
  }) => {
    if (saving) return;
    setSaving(true);
    try {
      if (editingSnippet) {
        const updated = await window.envoy.snippets.update(editingSnippet.id, data);
        setSnippets(snippets.map((s) => (s.id === updated.id ? updated : s)));
        toast.success('Snippet saved', `"${updated.name}" has been updated`);
        logSnippetUpdated(updated.id, updated.name);
      } else {
        const created = await window.envoy.snippets.create(data);
        setSnippets([created, ...snippets]);
        toast.success('Snippet created', `"${created.name}" has been added`);
        logSnippetCreated(created.id, created.name);
      }
      setShowEditor(false);
      setEditingSnippet(null);
    } catch (error) {
      console.error('Failed to save snippet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again';
      if (errorMessage.includes('UNIQUE') || errorMessage.includes('duplicate')) {
        toast.error('Duplicate shortcut', 'This shortcut already exists');
      } else {
        toast.error('Failed to save', errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const categories = ['', ...CATEGORY_OPTIONS.map((c) => c.value)];

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Snippets
          </h1>
          <button
            onClick={handleCreateSnippet}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New snippet
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat || 'all'}
                onClick={() => setCategoryFilter(cat as SnippetCategory | '')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  categoryFilter === cat
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {cat ? CATEGORY_OPTIONS.find((c) => c.value === cat)?.label : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested snippets banner */}
      {suggestedSnippets.length > 0 && (
        <div className="px-4 sm:px-6 md:px-8 pb-4">
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-600 dark:text-gray-300">Suggested:</span>
            {suggestedSnippets.map((s) => {
              const alreadyExists = snippets.some(
                (existing) => existing.shortcut === s.shortcut
              );
              return (
                <button
                  key={s.shortcut}
                  disabled={alreadyExists}
                  onClick={() => {
                    handleSaveSnippet({
                      name: s.name,
                      shortcut: s.shortcut,
                      content: s.content,
                      category: 'custom',
                    });
                  }}
                  className={`px-2.5 py-1 rounded-full border transition-colors ${
                    alreadyExists
                      ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 cursor-default'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
                  title={alreadyExists ? 'Already added' : `Add "${s.name}" snippet (#${s.shortcut})`}
                >
                  {alreadyExists ? `${s.name} ✓` : s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : filteredSnippets.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">
              {search || categoryFilter ? 'No snippets found' : 'No snippets yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {search || categoryFilter
                ? 'Try adjusting your search'
                : 'Create snippets to speed up writing'}
            </p>
            {!search && !categoryFilter && (
              <button
                onClick={handleCreateSnippet}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
              >
                Create a snippet
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="group flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Icon */}
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {snippet.name}
                    </h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                      <Hash className="w-3 h-3" />
                      {snippet.shortcut}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                      {snippet.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 whitespace-pre-wrap">
                    {snippet.content}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>Used {snippet.usageCount} times</span>
                    <button
                      onClick={() => handleCopySnippet(snippet)}
                      className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === snippet.id ? null : snippet.id)}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </button>

                  {openMenuId === snippet.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10 min-w-[120px]">
                      <button
                        onClick={() => handleEditSnippet(snippet)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSnippet(snippet)}
                        disabled={deletingId === snippet.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === snippet.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snippet Editor Modal */}
      {showEditor && (
        <SnippetEditorModal
          snippet={editingSnippet}
          onSave={handleSaveSnippet}
          onClose={() => {
            setShowEditor(false);
            setEditingSnippet(null);
          }}
          saving={saving}
        />
      )}

      {/* Click outside to close menu */}
      {openMenuId && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}

interface SnippetEditorModalProps {
  snippet: Snippet | null;
  onSave: (data: {
    name: string;
    shortcut: string;
    content: string;
    category: SnippetCategory;
  }) => void;
  onClose: () => void;
  saving?: boolean;
}

function SnippetEditorModal({ snippet, onSave, onClose, saving }: SnippetEditorModalProps) {
  const [name, setName] = useState(snippet?.name || '');
  const [shortcut, setShortcut] = useState(snippet?.shortcut || '');
  const [content, setContent] = useState(snippet?.content || '');
  const [category, setCategory] = useState<SnippetCategory>(snippet?.category || 'custom');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !shortcut.trim() || !content.trim()) return;
    onSave({
      name: name.trim(),
      shortcut: shortcut.trim().toLowerCase().replace(/\s+/g, '_'),
      content: content.trim(),
      category,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {snippet ? 'Edit snippet' : 'New snippet'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Professional greeting"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shortcut
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="hello"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SnippetCategory)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={5}
              placeholder="Enter the snippet text..."
              required
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Use {'{{ name }}'} or {'{{ company }}'} for variables
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!name.trim() || !shortcut.trim() || !content.trim() || saving}
            >
              {saving ? 'Saving...' : snippet ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
