import { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  Download,
  X,
  AlertCircle,
  CheckCircle,
  FileUp,
  Variable,
  PenTool,
  Plus,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useActivityLog } from '../hooks/useActivityLog';
import type { UploadedDocxTemplate, DocxTemplatePreview, RichDocument } from '@shared/types';
import DocumentEditor from './DocumentEditor';

export default function DocumentTemplates() {
  const [templates, setTemplates] = useState<UploadedDocxTemplate[]>([]);
  const [richDocs, setRichDocs] = useState<RichDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<UploadedDocxTemplate | null>(null);
  const [previewData, setPreviewData] = useState<DocxTemplatePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const toast = useToast();
  const { logDocumentGenerated } = useActivityLog();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [docxList, richList] = await Promise.all([
        window.envoy.docxTemplates.list(),
        window.envoy.richDocuments.list(),
      ]);
      setTemplates(docxList);
      setRichDocs(richList);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocx = async (template: UploadedDocxTemplate) => {
    if (!confirm(`Delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await window.envoy.docxTemplates.delete(template.id);
      toast.success('Template deleted');
      loadAll();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleDeleteRichDoc = async (doc: RichDocument) => {
    if (!confirm(`Delete "${doc.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await window.envoy.richDocuments.delete(doc.id);
      toast.success('Document deleted');
      setRichDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handlePreview = async (template: UploadedDocxTemplate) => {
    setSelectedTemplate(template);
    setPreviewModalOpen(true);
    setPreviewLoading(true);

    try {
      const sampleData: Record<string, string> = {};
      for (const variable of template.variables) {
        sampleData[variable] = `[${variable}]`;
      }

      const result = await window.envoy.docxTemplates.preview(template.id, sampleData);
      if (result.success && result.preview) {
        setPreviewData(result.preview);
      } else {
        toast.error(result.error || 'Failed to generate preview');
      }
    } catch (error) {
      console.error('Failed to preview template:', error);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGeneratePdf = async (template: UploadedDocxTemplate) => {
    try {
      const sampleData: Record<string, string> = {};
      for (const variable of template.variables) {
        sampleData[variable] = `Sample ${variable}`;
      }

      const result = await window.envoy.docxTemplates.render({
        templateId: template.id,
        data: sampleData,
        format: 'pdf',
      });

      if (result.success) {
        toast.success('PDF generated successfully');
        logDocumentGenerated(template.name, 'pdf');
      } else {
        toast.error(result.error || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleCreateRichDoc = async () => {
    try {
      const doc = await window.envoy.richDocuments.create({
        title: 'Untitled Document',
      });
      setRichDocs((prev) => [doc, ...prev]);
      setEditingDocId(doc.id);
    } catch (error) {
      toast.error('Failed to create document');
    }
  };

  // Editor view
  if (editingDocId) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0">
          <DocumentEditor
            initialDocId={editingDocId}
            onBack={() => {
              setEditingDocId(null);
              loadAll();
            }}
          />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="min-h-full bg-white dark:bg-gray-900 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Documents
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create rich documents or upload DOCX templates for personalized PDFs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateRichDoc}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Document
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload DOCX
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Loading documents...
        </div>
      ) : templates.length === 0 && richDocs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No documents yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create a document with the rich editor or upload a DOCX template
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCreateRichDoc}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <PenTool className="w-4 h-4" />
              Create Document
            </button>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              <Upload className="w-4 h-4" />
              Upload DOCX
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Rich Documents */}
          {richDocs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Documents ({richDocs.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {richDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer group"
                    onClick={() => setEditingDocId(doc.id)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-[var(--primary-tint-50)] rounded-lg flex items-center justify-center flex-shrink-0">
                        <PenTool className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {doc.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(doc.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDocId(doc.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-[var(--primary-tint-20)] rounded-lg transition-colors"
                      >
                        <PenTool className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRichDoc(doc);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DOCX Templates */}
          {templates.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                DOCX Templates ({templates.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {template.originalFileName}
                        </p>
                      </div>
                    </div>

                    {/* Variables */}
                    {template.variables.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                          <Variable className="w-3 h-3" />
                          Variables ({template.variables.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.variables.slice(0, 5).map((variable) => (
                            <span
                              key={variable}
                              className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                            >
                              {variable}
                            </span>
                          ))}
                          {template.variables.length > 5 && (
                            <span className="px-2 py-0.5 text-gray-500 dark:text-gray-400 text-xs">
                              +{template.variables.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handlePreview(template)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleGeneratePdf(template)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-[var(--primary-tint-20)] rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Test PDF
                      </button>
                      <button
                        onClick={() => handleDeleteDocx(template)}
                        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onUploaded={() => {
            setUploadModalOpen(false);
            loadAll();
          }}
        />
      )}

      {/* Preview Modal */}
      {previewModalOpen && selectedTemplate && (
        <PreviewModal
          template={selectedTemplate}
          preview={previewData}
          loading={previewLoading}
          onClose={() => {
            setPreviewModalOpen(false);
            setSelectedTemplate(null);
            setPreviewData(null);
          }}
        />
      )}
    </div>
  );
}

// Upload Modal Component
function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const handleSelectFile = async () => {
    const path = await window.envoy.dialog.openFile({
      title: 'Select DOCX Template',
      filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    });

    if (path) {
      setSelectedFile(path);
      const fileName = path.split(/[/\\]/).pop() || '';
      setTemplateName(fileName.replace('.docx', ''));

      setValidating(true);
      try {
        const result = await window.envoy.docxTemplates.validate(path);
        setValidation(result);
      } catch (error) {
        console.error('Validation failed:', error);
        setValidation({ valid: false, errors: ['Failed to validate template'], warnings: [] });
      } finally {
        setValidating(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !templateName.trim()) return;

    setUploading(true);
    try {
      const result = await window.envoy.docxTemplates.upload(selectedFile, templateName.trim());

      if (result.success) {
        toast.success('Template uploaded successfully');
        onUploaded();
      } else {
        toast.error(result.error || 'Failed to upload template');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload template');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload DOCX Template
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              DOCX File
            </label>
            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                  {selectedFile.split(/[/\\]/).pop()}
                </span>
                <button
                  onClick={handleSelectFile}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={handleSelectFile}
                className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
              >
                <FileUp className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to select a DOCX file
                </span>
              </button>
            )}
          </div>

          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template Name
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter a name for this template"
              className="input"
            />
          </div>

          {/* Validation Status */}
          {validating && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Validating template...
            </div>
          )}

          {validation && !validating && (
            <div
              className={`p-3 rounded-lg ${
                validation.valid
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {validation.valid ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-medium ${
                    validation.valid
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {validation.valid ? 'Template is valid' : 'Template has issues'}
                </span>
              </div>
              {validation.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {validation.errors.map((error, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-400">
                      • {error}
                    </li>
                  ))}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {validation.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-amber-600 dark:text-amber-400">
                      • {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !templateName.trim() || uploading || (validation && !validation.valid)}
            className="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Preview Modal Component
function PreviewModal({
  template,
  preview,
  loading,
  onClose,
}: {
  template: UploadedDocxTemplate;
  preview: DocxTemplatePreview | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preview: {template.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Variables Used */}
              {preview.variables.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Variables in template:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.variables.map((variable) => (
                      <code
                        key={variable}
                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm"
                      >
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* HTML Preview */}
              <div className="prose dark:prose-invert max-w-none">
                <div
                  className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Failed to load preview
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
