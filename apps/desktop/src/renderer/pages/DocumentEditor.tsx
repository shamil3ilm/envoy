import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table as TipTapTable } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image as TipTapImage } from '@tiptap/extension-image';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline as UnderlineExt } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Plus, FileText, Trash2, Search, ArrowLeft,
} from 'lucide-react';
import type { RichDocument } from '@shared/types';
import { FontSize } from '../components/DocumentEditor/extensions/FontSize';
import { LineHeight } from '../components/DocumentEditor/extensions/LineHeight';
import { PlaceholderNode } from '../components/DocumentEditor/extensions/PlaceholderNode';
import { DragHandle } from '../components/DocumentEditor/extensions/DragHandle';
import { ShapeNode } from '../components/DocumentEditor/extensions/ShapeNode';
import Toolbar from '../components/DocumentEditor/Toolbar';
import '../components/DocumentEditor/editor-styles.css';
import { useToast } from '../contexts/ToastContext';

interface DocumentEditorProps {
  initialDocId?: string;
  onBack?: () => void;
}

export default function DocumentEditor({ initialDocId, onBack }: DocumentEditorProps) {
  const [documents, setDocuments] = useState<RichDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<RichDocument | null>(null);
  const [pageColor, setPageColor] = useState('#ffffff');
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sidebarWidth] = useState(260);

  const toast = useToast();
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingDoc = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TipTapTable.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TipTapImage.configure({ inline: false, allowBase64: true }),
      Color,
      TextStyle,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      UnderlineExt,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Start writing your document...' }),
      FontSize,
      LineHeight,
      PlaceholderNode,
      DragHandle,
      ShapeNode,
    ],
    content: '',
    onUpdate: () => {
      if (isLoadingDoc.current) return;
      scheduleAutoSave();
    },
  });

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await window.envoy.richDocuments.list();
      setDocuments(docs);

      // Auto-open initial document if provided
      if (initialDocId && !activeDoc) {
        const target = docs.find((d) => d.id === initialDocId);
        if (target) openDocument(target);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  // Auto-save logic
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveCurrentDoc();
    }, 2000);
  }, [activeDoc]);

  const saveCurrentDoc = useCallback(async () => {
    if (!activeDoc || !editor) return;

    try {
      const content = JSON.stringify(editor.getJSON());
      const placeholders = extractPlaceholders(editor.getJSON());

      const updated = await window.envoy.richDocuments.update(activeDoc.id, {
        title: title || 'Untitled',
        content,
        pageColor,
        placeholders,
      });

      setActiveDoc(updated);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [activeDoc, editor, title, pageColor]);

  // Save on title/pageColor change
  useEffect(() => {
    if (!activeDoc || isLoadingDoc.current) return;
    scheduleAutoSave();
  }, [title, pageColor]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const extractPlaceholders = (json: any): string[] => {
    const placeholders: string[] = [];
    const walk = (node: any) => {
      if (node.type === 'placeholderNode' && node.attrs?.label) {
        if (!placeholders.includes(node.attrs.label)) {
          placeholders.push(node.attrs.label);
        }
      }
      if (node.content) {
        node.content.forEach(walk);
      }
    };
    walk(json);
    return placeholders;
  };

  const handleCreateDoc = async () => {
    try {
      const doc = await window.envoy.richDocuments.create({
        title: 'Untitled Document',
      });
      setDocuments((prev) => [doc, ...prev]);
      openDocument(doc);
      toast.success('Document created');
    } catch (error) {
      toast.error('Failed to create document');
    }
  };

  const openDocument = (doc: RichDocument) => {
    // Save current doc before switching
    if (activeDoc && editor) {
      saveCurrentDoc();
    }

    isLoadingDoc.current = true;
    setActiveDoc(doc);
    setTitle(doc.title);
    setPageColor(doc.pageColor || '#ffffff');

    if (editor) {
      try {
        const content = doc.content ? JSON.parse(doc.content) : { type: 'doc', content: [{ type: 'paragraph' }] };
        editor.commands.setContent(content);
      } catch {
        editor.commands.setContent('');
      }
    }

    setTimeout(() => {
      isLoadingDoc.current = false;
    }, 100);
  };

  const handleDelete = async (id: string) => {
    try {
      await window.envoy.richDocuments.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDoc?.id === id) {
        setActiveDoc(null);
        setTitle('');
        editor?.commands.setContent('');
      }
      setDeleteConfirm(null);
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleExportPdf = async () => {
    if (!editor || !activeDoc) return;
    await saveCurrentDoc();
    try {
      const outputPath = await window.envoy.dialog.saveFile({
        title: 'Export PDF',
        defaultPath: `${title || 'document'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!outputPath) return;
      const htmlContent = editor.getHTML();
      const result = await window.envoy.richDocuments.exportPdf({
        htmlContent,
        pageColor,
        outputPath,
      });
      if (result.success) {
        toast.success('PDF exported', `Saved to ${outputPath}`);
      } else {
        toast.error('Export failed', result.error || 'Unknown error');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleSavePdf = async () => {
    if (!editor || !activeDoc) return;
    await saveCurrentDoc();
    try {
      const htmlContent = editor.getHTML();
      const hasPlaceholders = extractPlaceholders(editor.getJSON()).length > 0;
      const result = await window.envoy.richDocuments.savePdf({
        htmlContent,
        pageColor,
        title: title || 'Untitled',
        docId: activeDoc.id,
        templateHtml: hasPlaceholders ? htmlContent : undefined,
      });
      if (result.success) {
        toast.success('Saved as PDF', `${result.filename} ready for attachments`);
      } else {
        toast.error('Save failed', result.error || 'Unknown error');
      }
    } catch (error) {
      toast.error('Save failed');
    }
  };

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full flex bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div
        className="flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 mb-3 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Documents
            </button>
          )}
          <button
            onClick={() => handleCreateDoc()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-3"
          >
            <Plus className="w-3.5 h-3.5" />
            New Document
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border-0 rounded-lg focus:ring-1 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {filteredDocs.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
              No documents yet
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => openDocument(doc)}
                className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                  activeDoc?.id === doc.id
                    ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)] border-l-2 border-l-primary-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {doc.title}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(doc.id);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeDoc ? (
          <>
            {/* Toolbar */}
            <Toolbar
              editor={editor}
              pageColor={pageColor}
              onPageColorChange={setPageColor}
              onExportPdf={handleExportPdf}
              onSavePdf={handleSavePdf}
            />

            {/* Title bar */}
            <div className="flex items-center gap-3 px-6 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-lg font-semibold bg-transparent text-gray-900 dark:text-white border-0 focus:ring-0 focus:outline-none placeholder-gray-400"
                placeholder="Document title..."
              />
            </div>

            {/* A4 canvas area */}
            <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 p-8">
              <div
                className="mx-auto shadow-lg"
                data-page-container
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '20mm 25mm',
                  backgroundColor: pageColor,
                  position: 'relative',
                }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No document selected
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select a document from the sidebar or create a new one
              </p>
              <button
                onClick={() => handleCreateDoc()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Document
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete document?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
