import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Eye, Check, AlertTriangle, ChevronDown, ChevronUp, X, Clock, Mail, MessageCircle, Paperclip, FileUp, Trash2, Plus, ArrowRight, ExternalLink, Monitor, Sparkles, MessagesSquare } from 'lucide-react';
import type { Template, Contact, UploadedDocxTemplate, DesktopMailApp, WebMailService, SavedPdfEntry } from '@shared/types';
import { DEFAULT_WEB_MAIL_SERVICES } from '@shared/types';
import { useActivityLog } from '../hooks/useActivityLog';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import ScheduleModal from '../components/ScheduleModal';

type Step = 'template' | 'recipients' | 'preview';

interface PreviewMessage {
  contact: Contact;
  subject: string;
  body: string;
  error?: string;
}

export default function Compose() {
  const [step, setStep] = useState<Step>('template');

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Recipients state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Preview state
  const [previews, setPreviews] = useState<PreviewMessage[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<Array<{ filename: string; path: string }>>([]);
  const [docxTemplates, setDocxTemplates] = useState<UploadedDocxTemplate[]>([]);
  const [selectedDocxTemplate, setSelectedDocxTemplate] = useState<UploadedDocxTemplate | null>(null);
  const [savedPdfs, setSavedPdfs] = useState<SavedPdfEntry[]>([]);

  // Signature picker (shown before sending personalized docs with signature placeholder)
  const [showSignaturePicker, setShowSignaturePicker] = useState(false);
  const [pendingScheduleArgs, setPendingScheduleArgs] = useState<{ scheduledFor: string; timezone: string } | null>(null);

  // Validation
  const [stepError, setStepError] = useState<string | null>(null);

  // Open mode: 'web' (webmail URL), 'app' (desktop app picker), 'teams' (MS Teams), or 'whatsapp'
  const [openMode, setOpenMode] = useState<'web' | 'app' | 'teams' | 'whatsapp'>('web');
  const [selectedWebService, setSelectedWebService] = useState<string>('gmail');
  const [showAppPicker, setShowAppPicker] = useState(false);

  // Desktop mail apps (auto-detected)
  const [desktopMailApps, setDesktopMailApps] = useState<DesktopMailApp[]>([]);

  const { log } = useActivityLog();
  const toast = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Web mail services: user-configured or defaults
  const webMailServices = useMemo<WebMailService[]>(() => {
    const configured = settings.preferences?.webMailServices;
    return configured && configured.length > 0 ? configured : DEFAULT_WEB_MAIL_SERVICES;
  }, [settings.preferences?.webMailServices]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    loadContacts();
    loadDocxTemplates();
    loadDesktopMailApps();
    loadSavedPdfs();
  }, []);

  async function loadDesktopMailApps() {
    try {
      if (typeof window.envoy.shell.detectDesktopMailApps === 'function') {
        const apps = await window.envoy.shell.detectDesktopMailApps();
        setDesktopMailApps(apps);
        // Auto-select app mode when desktop apps are detected
        if (apps.length > 0) {
          setOpenMode('app');
        }
      }
    } catch (error) {
      console.error('Failed to detect desktop mail apps:', error);
    }
  }

  async function loadDocxTemplates() {
    try {
      const templates = await window.envoy.docxTemplates.list();
      setDocxTemplates(templates);
    } catch (error) {
      console.error('Failed to load DOCX templates:', error);
    }
  }

  async function loadSavedPdfs() {
    try {
      const pdfs = await window.envoy.richDocuments.listSavedPdfs();
      setSavedPdfs(pdfs);
    } catch (error) {
      console.error('Failed to load saved PDFs:', error);
    }
  }

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      // Load all templates (email, whatsapp, both)
      const data = await window.envoy.templates.list();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadContacts() {
    try {
      setLoadingContacts(true);
      const data = await window.envoy.contacts.list();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  }

  // Generate previews when entering preview step
  useEffect(() => {
    if (step === 'preview' && selectedTemplate && selectedContacts.length > 0) {
      generatePreviews();
    }
  }, [step]);

  async function generatePreviews() {
    if (!selectedTemplate) return;

    setLoadingPreviews(true);
    const newPreviews: PreviewMessage[] = [];

    for (const contact of selectedContacts) {
      const data = {
        name: contact.name,
        first_name: contact.name.split(' ')[0],
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        title: contact.title || '',
        ...contact.customFields,
      };

      try {
        // Render subject
        let renderedSubject = selectedTemplate.subject || '';
        if (renderedSubject) {
          const subjectResult = await window.envoy.templates.render(renderedSubject, data);
          if (subjectResult.success && subjectResult.rendered) {
            renderedSubject = subjectResult.rendered;
          }
        }

        // Render body
        const bodyResult = await window.envoy.templates.render(selectedTemplate.body, data);
        if (bodyResult.success && bodyResult.rendered) {
          newPreviews.push({
            contact,
            subject: renderedSubject,
            body: bodyResult.rendered,
          });
        } else {
          newPreviews.push({
            contact,
            subject: renderedSubject,
            body: selectedTemplate.body,
            error: bodyResult.error || 'Failed to render',
          });
        }
      } catch (err) {
        newPreviews.push({
          contact,
          subject: selectedTemplate.subject || '',
          body: selectedTemplate.body,
          error: (err as Error).message,
        });
      }
    }

    setPreviews(newPreviews);
    setLoadingPreviews(false);
  }

  const toggleContact = (contact: Contact) => {
    setStepError(null);
    if (selectedContacts.find((c) => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter((c) => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const handleAddAttachment = async () => {
    const path = await window.envoy.dialog.openFile({
      title: 'Select Attachment',
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });

    if (path) {
      const filename = path.split(/[/\\]/).pop() || 'attachment';
      setAttachments([...attachments, { filename, path }]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const filteredContacts = contacts.filter((c) => {
    // Show contacts that have at least email or phone
    if (!c.email && !c.phone) return false;

    // Filter by search
    return (
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.company?.toLowerCase().includes(contactSearch.toLowerCase())
    );
  });

  const handleSchedule = async (scheduledFor: string, timezone: string) => {
    if (!selectedTemplate || selectedContacts.length === 0) return;

    // If personalized docs need a signature, prompt for signature choice first
    if (hasPersonalizedAttachments && needsSignatureChoice && savedSignatures.length > 0) {
      setPendingScheduleArgs({ scheduledFor, timezone });
      setShowScheduleModal(false);
      setShowSignaturePicker(true);
      return;
    }

    await doSchedule(scheduledFor, timezone);
  };

  /** Execute the scheduling with an optional signature override */
  const doSchedule = async (scheduledFor: string, timezone: string, signatureDataUrl?: string) => {
    if (!selectedTemplate || selectedContacts.length === 0) return;

    try {
      // Non-personalized attachment paths (static files)
      const staticPaths = attachments
        .filter(att => !savedPdfs.find(p => p.path === att.path)?.hasTemplate)
        .map(att => att.path);

      if (hasPersonalizedAttachments) {
        // Generate per-recipient PDFs and create individual scheduled messages
        toast.info('Generating personalized documents...');
        const recipientPdfs = await generateRecipientPdfs(selectedContacts, attachments, savedPdfs, signatureDataUrl);

        for (const contact of selectedContacts) {
          const personalPaths = recipientPdfs.get(contact.id) || [];
          await window.envoy.schedule.create({
            templateId: selectedTemplate.id,
            recipientIds: [contact.id],
            channel: 'email',
            scheduledFor,
            timezone,
            attachmentPaths: [...staticPaths, ...personalPaths],
          });
        }
      } else {
        // No personalized docs — single scheduled message for all
        await window.envoy.schedule.create({
          templateId: selectedTemplate.id,
          recipientIds: selectedContacts.map((c) => c.id),
          channel: 'email',
          scheduledFor,
          timezone,
          attachmentPaths: staticPaths,
        });
      }

      toast.success('Message scheduled', `Scheduled for ${selectedContacts.length} recipient${selectedContacts.length !== 1 ? 's' : ''}`);

      // Reset wizard
      setStep('template');
      setSelectedTemplate(null);
      setSelectedContacts([]);
      setPreviews([]);
    } catch (error) {
      console.error('Failed to schedule message:', error);
      toast.error('Scheduling failed', 'Could not schedule the message');
    }
  };

  const handleOpenInWhatsApp = async () => {
    const contactsWithPhone = previews.filter((p) => p.contact.phone);
    if (contactsWithPhone.length === 0) {
      toast.error('No phone numbers', 'None of the selected contacts have a phone number for WhatsApp.');
      return;
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const preview of contactsWithPhone) {
        const result = await window.envoy.whatsapp.send({
          phone: preview.contact.phone!,
          message: preview.body,
        });
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      const skipped = previews.length - contactsWithPhone.length;
      if (successCount > 0) {
        toast.success(
          'Opened in WhatsApp',
          `Opened ${successCount} chat${successCount !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped — no phone)` : ''}`
        );
      } else {
        toast.error('WhatsApp failed', 'Could not open any chats');
      }

      log('whatsapp_sent', 'email', `Opened WhatsApp for ${successCount} recipient${successCount !== 1 ? 's' : ''}`, {
        details: { templateName: selectedTemplate?.name, method: 'whatsapp-web', successCount, failCount, skipped },
      });
    } catch (err) {
      toast.error('Failed to open WhatsApp', (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleOpenIn = async () => {
    if (openMode === 'teams') {
      return handleOpenInTeams();
    }

    if (openMode === 'whatsapp') {
      return handleOpenInWhatsApp();
    }

    if (openMode === 'app') {
      // Show app picker modal
      setShowAppPicker(true);
      return;
    }

    // Web mode - open in selected web mail service
    const svc = webMailServices.find((s) => s.id === selectedWebService);
    if (!svc) return;

    setSending(true);
    try {
      for (const preview of previews) {
        if (!preview.contact.email) continue;
        const url = svc.composeUrl
          .replace('{to}', encodeURIComponent(preview.contact.email))
          .replace('{subject}', encodeURIComponent(preview.subject))
          .replace('{body}', encodeURIComponent(preview.body));
        await window.envoy.shell.openExternal(url);
      }

      toast.success(
        `Opened in ${svc.name}`,
        `Opened ${previews.length} compose window${previews.length !== 1 ? 's' : ''}`
      );
      log('email_sent', 'email', `Opened compose for ${previews.length} recipient${previews.length !== 1 ? 's' : ''}`, {
        details: { templateName: selectedTemplate?.name, method: `web:${svc.id}` },
      });
    } catch (err) {
      toast.error('Failed to open', (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleOpenInApp = async (app: DesktopMailApp) => {
    setShowAppPicker(false);
    setSending(true);
    try {
      for (const preview of previews) {
        if (!preview.contact.email) continue;
        if (typeof window.envoy.shell.openInDesktopMailApp === 'function') {
          await window.envoy.shell.openInDesktopMailApp({
            appId: app.id,
            appPath: app.path,
            to: preview.contact.email,
            subject: preview.subject,
            body: preview.body,
          });
        } else {
          await window.envoy.shell.openExternal(
            `mailto:${preview.contact.email}?subject=${encodeURIComponent(preview.subject)}&body=${encodeURIComponent(preview.body)}`
          );
        }
      }

      toast.success(
        `Opened in ${app.name}`,
        `Opened ${previews.length} compose window${previews.length !== 1 ? 's' : ''}`
      );
      log('email_sent', 'email', `Opened compose for ${previews.length} recipient${previews.length !== 1 ? 's' : ''}`, {
        details: { templateName: selectedTemplate?.name, method: `app:${app.id}` },
      });
    } catch (err) {
      toast.error('Failed to open', (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleOpenInDefault = async () => {
    setShowAppPicker(false);
    setSending(true);
    try {
      for (const preview of previews) {
        if (!preview.contact.email) continue;
        await window.envoy.shell.openExternal(
          `mailto:${preview.contact.email}?subject=${encodeURIComponent(preview.subject)}&body=${encodeURIComponent(preview.body)}`
        );
      }

      toast.success(
        'Opened in Default Mail App',
        `Opened ${previews.length} compose window${previews.length !== 1 ? 's' : ''}`
      );
      log('email_sent', 'email', `Opened compose for ${previews.length} recipient${previews.length !== 1 ? 's' : ''}`, {
        details: { templateName: selectedTemplate?.name, method: 'mailto' },
      });
    } catch (err) {
      toast.error('Failed to open', (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleOpenInTeams = async () => {
    // Check Teams auth status first
    const status = await window.envoy.teams.status();
    if (!status.configured) {
      toast.error('Teams not configured', 'Set your Azure AD Client ID in Settings > Integrations.');
      return;
    }
    if (!status.loggedIn) {
      toast.error('Not signed in', 'Sign in to Microsoft Teams in Settings > Integrations.');
      return;
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const preview of previews) {
        if (!preview.contact.email) continue;
        const result = await window.envoy.teams.send({
          email: preview.contact.email,
          message: preview.body,
        });
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Teams send failed for ${preview.contact.email}:`, result.error);
        }
      }

      if (successCount > 0 && failCount === 0) {
        toast.success(
          'Sent via Teams',
          `Message delivered to ${successCount} recipient${successCount !== 1 ? 's' : ''}`
        );
      } else if (successCount > 0) {
        toast.warning(
          'Partially sent',
          `${successCount} delivered, ${failCount} failed`
        );
      } else {
        toast.error('Teams send failed', 'Could not deliver to any recipient');
      }

      log('teams_sent', 'email', `Sent Teams message to ${successCount} recipient${successCount !== 1 ? 's' : ''}`, {
        details: { templateName: selectedTemplate?.name, method: 'teams-graph', successCount, failCount },
      });
    } catch (err) {
      toast.error('Failed to send via Teams', (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  /** Replace placeholder spans in HTML string with actual values */
  const replacePlaceholdersInHtml = (html: string, values: Record<string, string>): string => {
    return html.replace(
      /<span[^>]*data-placeholder-node[^>]*>\{\{\s*(.+?)\s*\}\}<\/span>/g,
      (match, key) => {
        const value = values[key];
        if (!value) return match;
        if (key === 'signature' && value.startsWith('data:')) {
          return `<img src="${value}" style="max-height:60px" />`;
        }
        return value;
      }
    );
  };

  /** Build auto-fill values for a contact from their data + sender profile */
  const buildContactValues = (contact: Contact, signatureDataUrl?: string): Record<string, string> => {
    const sigs = settings.profile?.signatures || [];
    const defaultSig = sigs.find(s => s.id === settings.profile?.defaultSignatureId) || sigs[0];

    return {
      name: contact.name || '',
      first_name: contact.name?.split(' ')[0] || '',
      last_name: contact.name?.split(' ').slice(1).join(' ') || '',
      company: contact.company || '',
      title: contact.title || '',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      sender_name: settings.profile?.name || '',
      sender_title: '',
      signature: signatureDataUrl ?? defaultSig?.dataUrl ?? '',
    };
  };

  /**
   * Generate per-recipient PDFs for saved docs that have templates.
   * Returns a map: contactId → array of personalized PDF paths
   */
  const generateRecipientPdfs = async (
    contacts: Contact[],
    pdfAttachments: Array<{ filename: string; path: string }>,
    savedPdfList: SavedPdfEntry[],
    signatureDataUrl?: string
  ): Promise<Map<string, string[]>> => {
    const result = new Map<string, string[]>();

    // Find which attached PDFs have templates
    const templatePdfs = pdfAttachments.filter(att => {
      const entry = savedPdfList.find(p => p.path === att.path);
      return entry?.hasTemplate;
    });

    if (templatePdfs.length === 0) return result;

    for (const contact of contacts) {
      const contactPaths: string[] = [];
      const values = buildContactValues(contact, signatureDataUrl);

      for (const tPdf of templatePdfs) {
        const template = await window.envoy.richDocuments.getTemplate(tPdf.path);
        if (!template) continue;

        const personalizedHtml = replacePlaceholdersInHtml(template.html, values);
        const safeName = contact.name.replace(/[^a-zA-Z0-9]/g, '_');
        const pdfResult = await window.envoy.richDocuments.renderTempPdf({
          htmlContent: personalizedHtml,
          pageColor: template.pageColor,
          filename: `${tPdf.filename.replace('.pdf', '')}_${safeName}.pdf`,
        });

        if (pdfResult.success && pdfResult.path) {
          contactPaths.push(pdfResult.path);
        }
      }

      if (contactPaths.length > 0) {
        result.set(contact.id, contactPaths);
      }
    }

    return result;
  };

  /** Check if any attached saved PDF has a template (needs per-recipient generation) */
  const hasPersonalizedAttachments = attachments.some(att => {
    const entry = savedPdfs.find(p => p.path === att.path);
    return entry?.hasTemplate;
  });

  /** Check if any attached template has a signature placeholder */
  const needsSignatureChoice = attachments.some(att => {
    const entry = savedPdfs.find(p => p.path === att.path);
    return entry?.hasTemplate && entry.placeholders?.includes('signature');
  });

  const savedSignatures = settings.profile?.signatures || [];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      greeting: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      invitation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      followup: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      apology: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      announcement: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };
    return colors[category] || colors.custom;
  };

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Compose Message
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create and send personalized messages to your contacts
        </p>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {[
          { key: 'template' as Step, label: 'Select Template', icon: FileText },
          { key: 'recipients' as Step, label: 'Choose Recipients', icon: Users },
          { key: 'preview' as Step, label: 'Preview & Send', icon: Eye },
        ].map((s, i) => {
          const stepOrder: Step[] = ['template', 'recipients', 'preview'];
          const currentIndex = stepOrder.indexOf(step);
          const stepIndex = stepOrder.indexOf(s.key);

          return (
            <div key={s.key} className="flex items-center gap-2">
              <button
                onClick={() => stepIndex < currentIndex && setStep(s.key)}
                disabled={stepIndex >= currentIndex}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  step === s.key
                    ? 'bg-primary-600 text-white'
                    : stepIndex < currentIndex
                    ? 'bg-primary-100 text-primary-600 hover:bg-primary-200 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {stepIndex < currentIndex ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
              </button>
              <span
                className={`text-sm font-medium ${
                  step === s.key ? 'text-primary-600' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
              {i < 2 && (
                <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="card p-6">
        {/* STEP 1: SELECT TEMPLATE */}
        {step === 'template' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Select a Template</h2>
            <p className="text-gray-500 mb-6">
              Choose a template to use for your message. The template will be personalized for each recipient.
            </p>

            {loadingTemplates ? (
              <div className="text-center py-12 text-gray-500">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-1">No templates found.</p>
                <p className="text-sm text-gray-400 mb-6">Create a template first to start composing messages.</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/templates')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Create Template
                  </button>
                  <button
                    onClick={() => navigate('/templates')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Go to Templates
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => { setSelectedTemplate(template); setStepError(null); }}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-primary-600 bg-primary-50 dark:bg-[var(--primary-tint-20)]'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <FileText className="w-5 h-5 text-primary-600" />
                      <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                        {template.category}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white">{template.name}</div>
                    {template.subject && (
                      <div className="text-sm text-gray-500 mt-1 truncate">
                        {template.subject}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500 capitalize mt-2">{template.channel}</div>
                  </button>
                ))}
              </div>
            )}

            {stepError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {stepError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!selectedTemplate) {
                    setStepError('Please select a template before proceeding');
                    return;
                  }
                  setStepError(null);
                  setStep('recipients');
                }}
                className="btn btn-primary"
              >
                Next: Choose Recipients
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE RECIPIENTS */}
        {step === 'recipients' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Choose Recipients</h2>
            <p className="text-gray-500 mb-6">
              Select the contacts who will receive this message.
            </p>

            {/* Selected recipients */}
            {selectedContacts.length > 0 && (
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">
                  Selected ({selectedContacts.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedContacts.map((contact) => (
                    <span
                      key={contact.id}
                      className="px-3 py-1 bg-primary-100 dark:bg-[var(--primary-tint-30)] text-primary-700 dark:text-primary-400 rounded-full text-sm flex items-center gap-2"
                    >
                      {contact.name}
                      <button
                        onClick={() => toggleContact(contact)}
                        className="hover:text-primary-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="input"
              />
            </div>

            {/* Contact list */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6 max-h-[400px] overflow-y-auto bg-white dark:bg-gray-800">
              {loadingContacts ? (
                <div className="text-center py-8 text-gray-500">Loading contacts...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No contacts found.</p>
                </div>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredContacts.map((contact) => {
                      const isSelected = selectedContacts.find((c) => c.id === contact.id);
                      return (
                        <tr
                          key={contact.id}
                          onClick={() => toggleContact(contact)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)]'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <td className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleContact(contact);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {contact.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-3">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="w-3 h-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {contact.company}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {stepError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {stepError}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => { setStepError(null); setStep('template'); }}
                className="btn btn-secondary"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (selectedContacts.length === 0) {
                    setStepError('Please select at least one recipient');
                    return;
                  }
                  setStepError(null);
                  setStep('preview');
                }}
                className="btn btn-primary"
              >
                Next: Preview ({selectedContacts.length} selected)
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & SEND */}
        {step === 'preview' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Preview & Send</h2>
            <p className="text-gray-500 mb-6">
              Review your personalized messages before sending. Click on a recipient to see their message.
            </p>

            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Template</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedTemplate?.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Recipients</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedContacts.length} contacts
                  </div>
                </div>
              </div>
            </div>

            {/* Open in selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Open in
              </label>
              {/* Mode toggle: Web / App */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setOpenMode('web')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    openMode === 'web'
                      ? 'border-primary-500 bg-primary-50 dark:bg-[var(--primary-tint-20)] text-primary-700 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  Web
                </button>
                <button
                  onClick={() => setOpenMode('app')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    openMode === 'app'
                      ? 'border-primary-500 bg-primary-50 dark:bg-[var(--primary-tint-20)] text-primary-700 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  App
                  {desktopMailApps.length > 0 && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                      {desktopMailApps.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setOpenMode('whatsapp')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    openMode === 'whatsapp'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
                {/* Teams button hidden for now — Graph API integration available but not exposed yet */}
              </div>
              {/* Web: service selector */}
              {openMode === 'web' && (
                <select
                  value={selectedWebService}
                  onChange={(e) => setSelectedWebService(e.target.value)}
                  className="input w-full max-w-xs"
                >
                  {webMailServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>{svc.name}</option>
                  ))}
                </select>
              )}
              {/* App: info text */}
              {openMode === 'app' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {desktopMailApps.length > 0
                    ? `${desktopMailApps.length} app${desktopMailApps.length !== 1 ? 's' : ''} detected. Click "Open" to choose.`
                    : 'No desktop mail apps detected. The default mail handler will be used.'}
                </p>
              )}
              {/* WhatsApp: info text */}
              {openMode === 'whatsapp' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Opens WhatsApp Web for each recipient with the message pre-filled. Contacts need a phone number.
                  {previews.length > 0 && (() => {
                    const withPhone = previews.filter(p => p.contact.phone).length;
                    const without = previews.length - withPhone;
                    return without > 0 ? (
                      <span className="block mt-1 text-amber-600 dark:text-amber-400">
                        {without} of {previews.length} recipient{previews.length !== 1 ? 's' : ''} missing phone number — will be skipped.
                      </span>
                    ) : null;
                  })()}
                </p>
              )}
              {/* Teams: info text */}
              {openMode === 'teams' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sends the message directly to each recipient's Teams chat via Microsoft Graph API. Configure your Azure AD Client ID in Settings &gt; Integrations.
                </p>
              )}
            </div>

            {/* Attachments Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Attachments
              </label>

                <div className="space-y-3">
                  {/* File Attachments */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Paperclip className="w-4 h-4" />
                        File Attachments
                      </span>
                      <button
                        onClick={handleAddAttachment}
                        className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        Add file
                      </button>
                    </div>
                    {attachments.length > 0 ? (
                      <div className="space-y-1">
                        {attachments.map((att, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between py-1 px-2 bg-gray-50 dark:bg-gray-800 rounded"
                          >
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {att.filename}
                            </span>
                            <button
                              onClick={() => handleRemoveAttachment(index)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">No files attached</p>
                    )}
                  </div>

                  {/* Document Template (PDF per recipient) */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <FileUp className="w-4 h-4" />
                        Document Template (PDF per recipient)
                      </span>
                    </div>
                    {docxTemplates.length > 0 ? (
                      <select
                        value={selectedDocxTemplate?.id || ''}
                        onChange={(e) => {
                          const template = docxTemplates.find((t) => t.id === e.target.value);
                          setSelectedDocxTemplate(template || null);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">No document template</option>
                        {docxTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.variables.length} variables)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        No document templates available.{' '}
                        <a href="/documents" className="text-primary-600 hover:underline">
                          Upload one
                        </a>
                      </p>
                    )}
                    {selectedDocxTemplate && (
                      <p className="text-xs text-gray-500 mt-2">
                        A personalized PDF will be generated for each recipient using contact data.
                      </p>
                    )}
                  </div>

                  {/* Saved Documents (from Editor) */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        Saved Documents
                      </span>
                    </div>
                    {savedPdfs.length > 0 ? (
                      <div className="space-y-1">
                        {savedPdfs.map((pdf, index) => {
                          const isAttached = attachments.some(a => a.path === pdf.path);
                          return (
                            <div
                              key={index}
                              className={`flex items-center justify-between py-1.5 px-2 rounded transition-colors ${
                                isAttached
                                  ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)] border border-primary-200 dark:border-primary-800'
                                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                  {pdf.filename}
                                </span>
                                {pdf.hasTemplate && (
                                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full whitespace-nowrap flex-shrink-0">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Per recipient
                                  </span>
                                )}
                              </div>
                              {isAttached ? (
                                <button
                                  onClick={() => setAttachments(attachments.filter(a => a.path !== pdf.path))}
                                  className="ml-2 p-1 text-red-400 hover:text-red-500 flex-shrink-0"
                                  title="Remove"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setAttachments([...attachments, { filename: pdf.filename, path: pdf.path }])}
                                  className="ml-2 p-1 text-primary-500 hover:text-primary-600 flex-shrink-0"
                                  title="Attach"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        No saved documents.{' '}
                        <a href="/documents" className="text-primary-600 hover:underline">
                          Create one in the Editor
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Personalized documents notice */}
                  {hasPersonalizedAttachments && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        <span className="font-medium">Personalized attachments enabled.</span>{' '}
                        Documents with placeholders will be auto-filled with each recipient's data (name, company, title, etc.) and generated as individual PDFs.
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* Previews */}
            {loadingPreviews ? (
              <div className="text-center py-8 text-gray-500">Generating previews...</div>
            ) : (
              <div className="space-y-3 mb-6">
                {previews.map((preview) => (
                  <div
                    key={preview.contact.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedPreview(
                          expandedPreview === preview.contact.id ? null : preview.contact.id
                        )
                      }
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 dark:bg-[var(--primary-tint-30)] rounded-full flex items-center justify-center">
                          <span className="text-primary-700 dark:text-primary-300 font-medium text-sm">
                            {preview.contact.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {preview.contact.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {preview.contact.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.error && (
                          <span className="text-red-500 text-sm flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            Error
                          </span>
                        )}
                        {expandedPreview === preview.contact.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {expandedPreview === preview.contact.id && (
                      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                        {preview.error && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-sm">
                            {preview.error}
                          </div>
                        )}
                        {preview.subject && (
                          <div className="mt-3">
                            <div className="text-xs text-gray-500 uppercase mb-1">Subject</div>
                            <div className="text-gray-900 dark:text-white">{preview.subject}</div>
                          </div>
                        )}
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 uppercase mb-1">Message</div>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 whitespace-pre-wrap text-gray-900 dark:text-white">
                            {preview.body}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {stepError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {stepError}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => { setStepError(null); setStep('recipients'); }}
                className="btn btn-secondary"
                disabled={sending}
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={sending || previews.length === 0}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Schedule
                </button>
                <button
                  onClick={() => {
                    setStepError(null);
                    handleOpenIn();
                  }}
                  disabled={sending || previews.length === 0}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {openMode === 'web' ? <ExternalLink className="w-4 h-4" /> : openMode === 'whatsapp' ? <MessageCircle className="w-4 h-4" /> : openMode === 'teams' ? <MessagesSquare className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                  {sending ? (openMode === 'teams' || openMode === 'whatsapp' ? 'Sending...' : 'Opening...') : openMode === 'web'
                    ? `Open in ${webMailServices.find(s => s.id === selectedWebService)?.name || 'Web'}`
                    : openMode === 'whatsapp'
                    ? 'Send via WhatsApp'
                    : openMode === 'teams'
                    ? 'Send via Teams'
                    : 'Open in App'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleSchedule}
        recipientCount={selectedContacts.length}
        templateName={selectedTemplate?.name || ''}
      />

      {/* App Picker Modal */}
      {/* Signature Picker Modal */}
      {showSignaturePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Choose Signature
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select a signature to include in personalized documents
              </p>
            </div>
            <div className="p-4 space-y-2">
              {savedSignatures.map((sig) => (
                <button
                  key={sig.id}
                  onClick={async () => {
                    setShowSignaturePicker(false);
                    if (pendingScheduleArgs) {
                      await doSchedule(pendingScheduleArgs.scheduledFor, pendingScheduleArgs.timezone, sig.dataUrl);
                      setPendingScheduleArgs(null);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-[var(--primary-tint-20)] transition-colors"
                >
                  <img
                    src={sig.dataUrl}
                    alt={sig.name}
                    className="h-10 max-w-[120px] object-contain flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {sig.name}
                  </span>
                </button>
              ))}
              <button
                onClick={async () => {
                  setShowSignaturePicker(false);
                  if (pendingScheduleArgs) {
                    await doSchedule(pendingScheduleArgs.scheduledFor, pendingScheduleArgs.timezone);
                    setPendingScheduleArgs(null);
                  }
                }}
                className="w-full p-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                Skip (no signature)
              </button>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setShowSignaturePicker(false);
                  setPendingScheduleArgs(null);
                }}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAppPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Select an app to open with
              </h3>
            </div>
            <div className="p-2">
              {desktopMailApps.length > 0 && (
                <>
                  <p className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Detected apps
                  </p>
                  {desktopMailApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => handleOpenInApp(app)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{app.name}</span>
                    </button>
                  ))}
                </>
              )}
              <p className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
                {desktopMailApps.length > 0 ? 'Other' : 'Options'}
              </p>
              <button
                onClick={handleOpenInDefault}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Default Mail App</span>
              </button>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowAppPicker(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
