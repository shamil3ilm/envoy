import { useState, useEffect } from 'react';
import { X, Replace, Image as ImageIcon } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { TEMPLATE_PLACEHOLDERS } from '@shared/constants';
import { useSettings } from '../../contexts/SettingsContext';

interface ReplacePlaceholdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor;
  /** Called after replacement is done OR user clicks "Skip". Use for post-action like export. */
  onDone?: () => void;
  /** Show a "Skip & Continue" button (used when triggered from export/save flow) */
  showSkip?: boolean;
  /** Export mode: called with replacement values WITHOUT modifying the document.
   *  When provided, "Replace All" passes values to parent instead of editing the editor. */
  onReplace?: (values: Record<string, string>) => void;
}

export default function ReplacePlaceholdersModal({
  isOpen,
  onClose,
  editor,
  onDone,
  showSkip,
  onReplace,
}: ReplacePlaceholdersModalProps) {
  const { settings } = useSettings();
  const [values, setValues] = useState<Record<string, string>>({});
  const [placeholders, setPlaceholders] = useState<string[]>([]);

  // Scan document for placeholders when modal opens
  useEffect(() => {
    if (!isOpen || !editor) return;

    const found: string[] = [];
    const json = editor.getJSON();
    const walk = (node: any) => {
      if (node.type === 'placeholderNode' && node.attrs?.label) {
        if (!found.includes(node.attrs.label)) {
          found.push(node.attrs.label);
        }
      }
      if (node.content) node.content.forEach(walk);
    };
    walk(json);
    setPlaceholders(found);

    // Pre-fill with smart defaults
    const defaults: Record<string, string> = {};
    const sigs = settings.profile?.signatures || [];
    const defaultSig = sigs.find(s => s.id === settings.profile?.defaultSignatureId) || sigs[0];

    for (const key of found) {
      switch (key) {
        case 'sender_name':
          defaults[key] = settings.profile?.name || '';
          break;
        case 'date':
          defaults[key] = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
          break;
        case 'time':
          defaults[key] = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit',
          });
          break;
        case 'signature':
          defaults[key] = defaultSig?.dataUrl || '';
          break;
        default:
          defaults[key] = '';
      }
    }
    setValues(defaults);
  }, [isOpen, editor, settings]);

  if (!isOpen) return null;

  const getPlaceholderDescription = (key: string) => {
    const p = TEMPLATE_PLACEHOLDERS.find(tp => tp.key === key);
    return p?.description || '';
  };

  const handleReplace = () => {
    if (!editor) return;

    // Export mode: pass values to parent without modifying the document
    if (onReplace) {
      onReplace(values);
      onClose();
      return;
    }

    // Edit mode: modify document directly
    const { state } = editor;
    const { tr } = state;
    const replacements: { from: number; to: number; label: string }[] = [];

    state.doc.descendants((node, pos) => {
      if (node.type.name === 'placeholderNode' && node.attrs.label) {
        replacements.push({
          from: pos,
          to: pos + node.nodeSize,
          label: node.attrs.label,
        });
      }
    });

    replacements.sort((a, b) => b.from - a.from);

    for (const { from, to, label } of replacements) {
      const value = values[label];
      if (!value) continue;

      if (label === 'signature' && value.startsWith('data:')) {
        const imageNode = state.schema.nodes.image?.create({ src: value });
        if (imageNode) {
          tr.replaceWith(from, to, imageNode);
        }
      } else {
        tr.replaceWith(from, to, state.schema.text(value));
      }
    }

    editor.view.dispatch(tr);
    onClose();
    onDone?.();
  };

  const handleSkip = () => {
    if (onReplace) {
      onReplace({}); // empty = no replacements, just proceed
      onClose();
    } else {
      onClose();
      onDone?.();
    }
  };

  const hasValues = Object.values(values).some(v => v.trim() !== '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Replace Placeholders
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Fill in values to replace placeholder tokens in your document
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {placeholders.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
              No placeholders found in this document.
              <br />
              <span className="text-xs">Insert placeholders from the toolbar first.</span>
            </div>
          ) : (
            placeholders.map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span className="font-mono text-primary-600 dark:text-primary-400">
                    {'{{ ' + key + ' }}'}
                  </span>
                  {getPlaceholderDescription(key) && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      {getPlaceholderDescription(key)}
                    </span>
                  )}
                </label>

                {key === 'signature' ? (
                  <div className="space-y-2">
                    {values[key] ? (
                      <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <img
                          src={values[key]}
                          alt="Signature"
                          className="h-10 max-w-[150px] object-contain"
                        />
                        <button
                          onClick={() => setValues(prev => ({ ...prev, [key]: '' }))}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {(settings.profile?.signatures || []).map((sig) => (
                          <button
                            key={sig.id}
                            onClick={() => setValues(prev => ({ ...prev, [key]: sig.dataUrl }))}
                            className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-400 transition-colors"
                          >
                            <img
                              src={sig.dataUrl}
                              alt={sig.name}
                              className="h-8 max-w-[100px] object-contain"
                            />
                          </button>
                        ))}
                        {(settings.profile?.signatures || []).length === 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" />
                            No signatures saved. Add one in Settings &gt; Profile.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={values[key] || ''}
                    onChange={(e) => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Enter ${key.replace(/_/g, ' ')}...`}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {placeholders.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-400">
              {placeholders.length} placeholder{placeholders.length !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {showSkip && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Skip &amp; Continue
                </button>
              )}
              <button
                onClick={handleReplace}
                disabled={!hasValues}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Replace className="w-3.5 h-3.5" />
                Replace All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
