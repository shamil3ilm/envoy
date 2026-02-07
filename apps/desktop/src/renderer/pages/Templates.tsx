import { useEffect, useState } from 'react';
import { Plus, Search, FileText, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import type { Template } from '@shared/types';
import { TEMPLATE_CATEGORIES } from '@shared/constants';
import TemplateEditor from '../components/TemplateEditor';
import { useActivityLog } from '../hooks/useActivityLog';
import { useToast } from '../contexts/ToastContext';
import { useUserProfiles } from '../hooks/useUserProfiles';
import { formatDistanceToNow } from 'date-fns';

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { logTemplateCreated, logTemplateUpdated, logTemplateDeleted } = useActivityLog();
  const toast = useToast();
  const { suggestedTemplateNames } = useUserProfiles();

  useEffect(() => {
    loadTemplates();
  }, [categoryFilter]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const filter = categoryFilter ? { category: categoryFilter } : undefined;
      const data = await window.envoy.templates.list(filter);
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      const template = templates.find(t => t.id === id);
      await window.envoy.templates.delete(id);
      setTemplates(templates.filter(t => t.id !== id));
      setDeleteConfirm(null);
      if (template) {
        logTemplateDeleted(id, template.name);
        toast.success('Template deleted', `"${template.name}" has been removed`);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Delete failed', 'Could not delete the template');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = (template: Template) => {
    if (editingTemplate) {
      setTemplates(templates.map(t => t.id === template.id ? template : t));
      logTemplateUpdated(template.id, template.name);
      toast.success('Template saved', `"${template.name}" has been updated`);
    } else {
      setTemplates([template, ...templates]);
      logTemplateCreated(template.id, template.name);
      toast.success('Template created', `"${template.name}" has been added`);
    }
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.body.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ['', ...Object.keys(TEMPLATE_CATEGORIES)];

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Templates
          </h1>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
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

          {/* Category tabs */}
          <div className="flex items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat || 'all'}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  categoryFilter === cat
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {cat ? TEMPLATE_CATEGORIES[cat]?.label : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested templates banner */}
      {suggestedTemplateNames.length > 0 && (
        <div className="px-4 sm:px-6 md:px-8 pb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-600 dark:text-gray-300">Suggested:</span>
            {suggestedTemplateNames.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setEditingTemplate(null);
                  setShowEditor(true);
                }}
                className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">
              {search || categoryFilter ? 'No templates found' : 'No templates yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {search || categoryFilter
                ? 'Try adjusting your search or filter'
                : 'Create your first template to get started'}
            </p>
            {!search && !categoryFilter && (
              <button
                onClick={handleCreate}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
              >
                Create a template
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="group flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => handleEdit(template)}
              >
                {/* Icon */}
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {template.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {template.subject || template.body.substring(0, 80)}
                  </p>
                </div>

                {/* Meta */}
                <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right">
                    {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Actions */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === template.id ? null : template.id);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </button>

                  {menuOpen === template.id && (
                    <div className="absolute right-0 top-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10 min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(template);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(template.id);
                          setMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onClose={() => {
            setShowEditor(false);
            setEditingTemplate(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete template?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
}
