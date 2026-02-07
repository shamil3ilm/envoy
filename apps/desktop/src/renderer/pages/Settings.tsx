import { useEffect, useState } from 'react';
import {
  Mail,
  Shield,
  Palette,
  Database,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Puzzle,
  Lock,
  ExternalLink,
  User,
  Send,
  Lightbulb,
  Bug,
  Sparkles,
  MessageSquare,
  Settings2,
  Bell,
  Volume2,
  Upload,
  Play,
  PenTool,
  Star,
  FileText,
  LayoutGrid,
  Zap,
  Clock,
  History,
  Users,
  Calendar,
  CheckSquare,
  StickyNote,
  FileUp,
  DollarSign,
  Calculator,
  Activity,
  Timer,
  Workflow,
  Smartphone,
} from 'lucide-react';
import type { EmailAccount, AccentColor, FontSize, Currency, TimeFormat, DateFormat, UserProfileCategory, WeekStart, NotificationSound, NotificationSoundType, VibrationPattern, WebMailService, SavedSignature, PlaceholderDefault, PlaceholderGroup } from '@shared/types';
import { ACCENT_COLORS, CURRENCIES, USER_PROFILES, DEFAULT_WEB_MAIL_SERVICES, SETUP_FEATURE_GROUPS, VIBRATION_OPTIONS } from '@shared/types';
import { PLACEHOLDER_GROUPS, DEFAULT_PLACEHOLDER_DEFAULTS } from '@shared/constants';
import { ICON_MAP } from '../utils/iconMap';
import { playNotificationSound, SOUND_OPTIONS } from '../utils/notificationSounds';
import { useActivityLog } from '../hooks/useActivityLog';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import SignatureModal from '../components/DocumentEditor/SignatureModal';

type SettingsTab = 'profile' | 'templates' | 'preferences' | 'features' | 'notifications' | 'safety' | 'appearance' | 'integrations' | 'system' | 'feedback';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'templates', label: 'Templates', icon: <FileText className="w-4 h-4" /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'features', label: 'Features', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'safety', label: 'Safety', icon: <Shield className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Puzzle className="w-4 h-4" /> },
  { id: 'system', label: 'System', icon: <Database className="w-4 h-4" /> },
  { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
];

// Brand SVG Icons
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TeamsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M20.625 8.073c-.009-.054-.027-.1-.054-.135a.477.477 0 0 0-.027-.054h-.009a.591.591 0 0 0-.063-.081.444.444 0 0 0-.072-.063l-.018-.009a.588.588 0 0 0-.081-.054.444.444 0 0 0-.135-.054A2.073 2.073 0 0 0 20.166 7.5h-3.294a2.917 2.917 0 0 0 .546-1.708 2.917 2.917 0 0 0-2.917-2.917 2.917 2.917 0 0 0-2.917 2.917c0 .638.205 1.228.546 1.708H8.834c-.045 0-.09.009-.135.018a.444.444 0 0 0-.135.054.59.59 0 0 0-.081.054l-.018.009a.444.444 0 0 0-.072.063.59.59 0 0 0-.063.081h-.009a.477.477 0 0 0-.027.054.444.444 0 0 0-.054.135 2.07 2.07 0 0 0-.018.135v7.292a2.917 2.917 0 0 0 2.917 2.917h5.833a2.917 2.917 0 0 0 2.917-2.917V8.208c0-.045-.009-.09-.018-.135h-.009zM14.5 4.375a1.417 1.417 0 1 1 0 2.833 1.417 1.417 0 0 1 0-2.833zm4.167 10.917a1.417 1.417 0 0 1-1.417 1.416h-5.833a1.417 1.417 0 0 1-1.417-1.416V9h8.667v6.292z"/>
    <circle cx="19.5" cy="5.5" r="2.5"/>
  </svg>
);

const JiraIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
  </svg>
);

const INTEGRATIONS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send messages via WhatsApp Web',
    icon: <WhatsAppIcon />,
    color: 'bg-green-500',
    status: 'available' as const,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Automate Telegram messages',
    icon: <TelegramIcon />,
    color: 'bg-blue-500',
    status: 'coming_soon' as const,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Auto-reply to issues and PRs',
    icon: <GitHubIcon />,
    color: 'bg-gray-800',
    status: 'coming_soon' as const,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Respond to comments',
    icon: <YouTubeIcon />,
    color: 'bg-red-600',
    status: 'coming_soon' as const,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Send direct chat messages via Graph API',
    icon: <TeamsIcon />,
    color: 'bg-purple-600',
    status: 'coming_soon' as const,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Update issues and comments',
    icon: <JiraIcon />,
    color: 'bg-blue-600',
    status: 'coming_soon' as const,
  },
];

/** Inline component for Teams sign-in / sign-out */
function TeamsAuthSection({ clientId }: { clientId?: string }) {
  const [status, setStatus] = useState<{ configured: boolean; loggedIn: boolean; email: string | null }>({ configured: false, loggedIn: false, email: null });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    window.envoy.teams.status().then(setStatus).catch(() => {});
  }, [clientId]);

  const handleLogin = async () => {
    setBusy(true);
    try {
      const result = await window.envoy.teams.login();
      if (result.success) {
        toast.success('Signed in to Teams', `Authenticated as ${result.email}`);
        setStatus({ configured: true, loggedIn: true, email: result.email || null });
      } else {
        toast.error('Teams sign-in failed', result.error || 'Unknown error');
      }
    } catch (err) {
      toast.error('Teams sign-in failed', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await window.envoy.teams.logout();
    setStatus({ configured: true, loggedIn: false, email: null });
    toast.success('Signed out', 'Teams account disconnected');
  };

  if (!clientId) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Enter a Client ID above to enable Teams integration.
      </p>
    );
  }

  if (status.loggedIn) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Signed in as <span className="font-medium">{status.email}</span>
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={busy}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
      {busy ? 'Signing in...' : 'Sign in to Microsoft Teams'}
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [pythonStatus, setPythonStatus] = useState<{ running: boolean; version?: string }>({
    running: false,
  });

  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);

  // Feedback state
  const [feedbackType, setFeedbackType] = useState<'feature' | 'bug' | 'general' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    fromName: '',
    fromEmail: '',
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    isDefault: false,
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [editingWebMailId, setEditingWebMailId] = useState<string | null>(null);
  const [webMailForm, setWebMailForm] = useState({ name: '', composeUrl: '' });
  const [editingPlaceholder, setEditingPlaceholder] = useState<string | null>(null);
  const [placeholderForm, setPlaceholderForm] = useState({ key: '', label: '', defaultValue: '', group: 'custom' as PlaceholderGroup });

  const { logEmailAccountAdded, logEmailAccountRemoved } = useActivityLog();
  const { theme: themeSettings, setThemeMode, setAccentColor, setFontSize, setReducedMotion, setCompactMode } = useTheme();
  const toast = useToast();
  const { settings, updateSettings, updatePreferences, loading } = useSettings();

  useEffect(() => {
    loadEmailAccounts();
    checkPythonStatus();
  }, []);

  async function loadEmailAccounts() {
    try {
      const accounts = await window.envoy.email.accounts.list();
      setEmailAccounts(accounts);
    } catch (error) {
      console.error('Failed to load email accounts:', error);
    }
  }

  async function checkPythonStatus() {
    try {
      const status = await window.envoy.python.status();
      setPythonStatus(status);
    } catch (error) {
      console.error('Failed to check Python status:', error);
    }
  }

  async function handleAddAccount() {
    if (!accountForm.name || !accountForm.fromEmail || !accountForm.host || !accountForm.user) {
      setAccountError('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(accountForm.fromEmail.trim())) {
      setAccountError('Invalid email address format');
      return;
    }

    if (!accountForm.password) {
      setAccountError('Password is required');
      return;
    }

    setAddingAccount(true);
    setAccountError(null);

    try {
      const account = await window.envoy.email.accounts.add({
        name: accountForm.name,
        type: 'smtp',
        fromName: accountForm.fromName || accountForm.name,
        fromEmail: accountForm.fromEmail,
        config: {
          host: accountForm.host,
          port: accountForm.port,
          secure: accountForm.secure,
          user: accountForm.user,
          password: accountForm.password,
        },
        isDefault: accountForm.isDefault || emailAccounts.length === 0,
      });

      setEmailAccounts([...emailAccounts, account]);
      setShowAddAccount(false);
      logEmailAccountAdded(account.id, account.name, account.fromEmail);
      toast.success('Account added', `"${account.name}" is ready to use`);
      setAccountForm({
        name: '',
        fromName: '',
        fromEmail: '',
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
        isDefault: false,
      });
    } catch (err) {
      setAccountError(formatEmailError((err as Error).message));
    } finally {
      setAddingAccount(false);
    }
  }

  function formatEmailError(message: string): string {
    if (!message) return 'Failed to add account';
    // Strip Electron IPC wrapper
    const cleaned = message.replace(/^Error invoking remote method '[^']+': Error: /, '');
    // Map common SMTP errors to friendly messages
    if (cleaned.includes('ENOTFOUND')) {
      const host = cleaned.match(/ENOTFOUND\s+(\S+)/)?.[1];
      return `Could not find SMTP server "${host || 'unknown'}". Check the host address.`;
    }
    if (cleaned.includes('ECONNREFUSED')) {
      return 'Connection refused. Check the host and port are correct.';
    }
    if (cleaned.includes('ETIMEDOUT') || cleaned.includes('ESOCKET')) {
      return 'Connection timed out. Check your host, port, and SSL/TLS settings.';
    }
    if (cleaned.includes('EAUTH') || cleaned.includes('Invalid login') || cleaned.includes('authentication')) {
      return 'Authentication failed. Check your username and password.';
    }
    if (cleaned.includes('self signed certificate') || cleaned.includes('SSL')) {
      return 'SSL/TLS error. Try toggling the "Use SSL/TLS" option.';
    }
    return cleaned;
  }

  async function handleTestAccount(accountId: string) {
    setTestingAccount(accountId);
    try {
      const result = await window.envoy.email.accounts.test(accountId);
      if (result.success) {
        toast.success('Connection successful', 'Email account is working');
      } else {
        toast.error('Connection failed', formatEmailError(result.error || 'Unable to connect'));
      }
    } catch (err) {
      toast.error('Test failed', (err as Error).message || 'Unable to verify connection');
    } finally {
      setTestingAccount(null);
    }
  }

  async function handleRemoveAccount(accountId: string) {
    if (!confirm('Remove this email account?')) return;

    try {
      const account = emailAccounts.find((a) => a.id === accountId);
      await window.envoy.email.accounts.remove(accountId);
      setEmailAccounts(emailAccounts.filter((a) => a.id !== accountId));
      if (account) {
        logEmailAccountRemoved(accountId, account.name);
        toast.success('Account removed', `"${account.name}" has been deleted`);
      }
    } catch (err) {
      toast.error('Remove failed', (err as Error).message || 'Could not remove account');
    }
  }

  async function restartPython() {
    try {
      await window.envoy.python.restart();
      await checkPythonStatus();
      toast.success('Python restarted', 'Engine is running');
    } catch (error) {
      console.error('Failed to restart Python:', error);
      toast.error('Restart failed', 'Could not restart Python engine');
    }
  }

  async function handleSubmitFeedback() {
    if (!feedbackText.trim() || !feedbackType) return;
    if (submittingFeedback) return;

    setSubmittingFeedback(true);
    try {
      const typeLabels = {
        feature: 'Feature Request',
        bug: 'Bug Report',
        general: 'General Feedback',
      };

      const subject = `[Envoy Feedback] ${typeLabels[feedbackType]}`;
      const body = feedbackText.trim();
      const mailto = `mailto:shamil3ilm@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      await window.envoy.shell.openExternal(mailto);

      toast.success('Feedback ready', 'Your mail app has been opened. Please review and send.');
      setFeedbackText('');
      setFeedbackType(null);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Submit failed', 'Could not open your mail app');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-36 sm:w-44 md:w-48 border-r border-gray-200 dark:border-gray-700 p-2 sm:p-3 md:p-4">
        <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-3">
          Settings
        </h2>
        <nav className="space-y-0.5">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl p-4 sm:p-6 md:p-8">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Profile
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Personalize your experience
                </p>
              </div>

              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile?.name || ''}
                    onChange={async (e) => {
                      const newProfile = { ...settings.profile, name: e.target.value };
                      await updateSettings({ profile: newProfile });
                    }}
                    onBlur={() => {
                      toast.success('Profile saved', 'Your name has been updated');
                    }}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Used in the dashboard greeting
                  </p>
                </div>

                {/* Show name in greeting toggle */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Show name in greeting
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Display your name in the dashboard greeting
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newProfile = {
                        ...settings.profile,
                        showNameInGreeting: !settings.profile?.showNameInGreeting,
                      };
                      await updateSettings({ profile: newProfile });
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      settings.profile?.showNameInGreeting !== false
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.profile?.showNameInGreeting !== false ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* About Me */}
                <div className="pt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    About me
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Choose what describes you. Each adds tailored features and suggestions.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(USER_PROFILES) as [UserProfileCategory, typeof USER_PROFILES[UserProfileCategory]][]).map(
                      ([id, profile]) => {
                        const isActive = (settings.preferences?.userProfiles || []).includes(id);
                        const IconComponent = ICON_MAP[profile.icon];
                        return (
                          <button
                            key={id}
                            onClick={async () => {
                              const current = settings.preferences?.userProfiles || [];
                              const updated = isActive
                                ? current.filter(p => p !== id)
                                : [...current, id];
                              await updatePreferences({ userProfiles: updated });
                              toast.success('Profile updated', isActive ? `${profile.label} disabled` : `${profile.label} enabled`);
                            }}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                              isActive
                                ? 'border-primary-500 bg-primary-50 dark:bg-[var(--primary-tint-20)]'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${profile.color}20` }}
                            >
                              {IconComponent && <IconComponent className="w-4 h-4" style={{ color: profile.color }} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm font-medium ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {profile.label}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile.description}</div>
                            </div>
                            {isActive && <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Email Accounts */}
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email Accounts
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Connect accounts to send messages
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddAccount(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>

                  {emailAccounts.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-1 text-sm">No accounts</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Add an SMTP account to start sending
                      </p>
                      <button
                        onClick={() => setShowAddAccount(true)}
                        className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                      >
                        Add email account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {emailAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                                {account.name}
                                {account.isDefault && (
                                  <span className="px-1.5 py-0.5 bg-primary-100 dark:bg-[var(--primary-tint-30)] text-primary-700 dark:text-primary-400 text-xs rounded">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{account.fromEmail}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTestAccount(account.id)}
                              disabled={testingAccount === account.id}
                              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              {testingAccount === account.id ? 'Testing...' : 'Test'}
                            </button>
                            <button
                              onClick={() => handleRemoveAccount(account.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Preferences
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Regional and display settings
                </p>
              </div>

              <div className="space-y-6">
                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={settings.preferences?.currency || 'USD'}
                    onChange={async (e) => {
                      const currency = e.target.value as Currency;
                      await updatePreferences({ currency });
                      toast.success('Currency updated', `Now using ${CURRENCIES[currency]?.name}`);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {(Object.entries(CURRENCIES) as [Currency, { flag: string; name: string }][]).map(([code, { flag, name }]) => (
                      <option key={code} value={code}>
                        {flag}  {name} ({code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Used for expense tracking and financial displays
                  </p>
                </div>

                {/* Date & Time Format */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date Format
                    </label>
                    <select
                      value={settings.preferences?.dateFormat || 'system'}
                      onChange={async (e) => {
                        await updatePreferences({ dateFormat: e.target.value as DateFormat });
                        toast.success('Date format updated');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="system">System default</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time Format
                    </label>
                    <select
                      value={settings.preferences?.timeFormat || 'system'}
                      onChange={async (e) => {
                        await updatePreferences({ timeFormat: e.target.value as TimeFormat });
                        toast.success('Time format updated');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="system">System default</option>
                      <option value="12h">12-hour (2:30 PM)</option>
                      <option value="24h">24-hour (14:30)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-4">
                  Used for date and time displays across the app
                </p>

                {/* Week Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Week Starts On
                  </label>
                  <select
                    value={settings.preferences?.weekStart || 'system'}
                    onChange={async (e) => {
                      await updatePreferences({ weekStart: e.target.value as WeekStart });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="system">System default</option>
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Used for calendar views and weekly expense reports
                  </p>
                </div>

                {/* Web Mail Services */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Web Mail Services
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Configure web mail services for the "Open in" options in Compose. Use {'{to}'}, {'{subject}'}, {'{body}'} placeholders in the URL.
                  </p>
                  <div className="space-y-2">
                    {(settings.preferences?.webMailServices || DEFAULT_WEB_MAIL_SERVICES).map((svc) => (
                      <div key={svc.id}>
                        {editingWebMailId === svc.id ? (
                          <div className="p-3 bg-primary-50 dark:bg-[var(--primary-tint-20)] border border-primary-200 dark:border-primary-800 rounded-lg space-y-2">
                            <input
                              type="text"
                              value={webMailForm.name}
                              onChange={(e) => setWebMailForm({ ...webMailForm, name: e.target.value })}
                              placeholder="Service name"
                              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                            <input
                              type="text"
                              value={webMailForm.composeUrl}
                              onChange={(e) => setWebMailForm({ ...webMailForm, composeUrl: e.target.value })}
                              placeholder="https://mail.example.com/compose?to={to}&subject={subject}&body={body}"
                              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-xs"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setEditingWebMailId(null); setWebMailForm({ name: '', composeUrl: '' }); }}
                                className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  if (!webMailForm.name.trim() || !webMailForm.composeUrl.trim()) return;
                                  const current = settings.preferences?.webMailServices || DEFAULT_WEB_MAIL_SERVICES;
                                  const updated = current.map((s) =>
                                    s.id === svc.id ? { ...s, name: webMailForm.name.trim(), composeUrl: webMailForm.composeUrl.trim() } : s
                                  );
                                  await updatePreferences({ webMailServices: updated });
                                  setEditingWebMailId(null);
                                  setWebMailForm({ name: '', composeUrl: '' });
                                }}
                                className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                setEditingWebMailId(svc.id);
                                setWebMailForm({ name: svc.name, composeUrl: svc.composeUrl });
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{svc.name}</span>
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-7 truncate">
                                {svc.composeUrl.split('?')[0]}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingWebMailId(svc.id);
                                  setWebMailForm({ name: svc.name, composeUrl: svc.composeUrl });
                                }}
                                className="p-1.5 text-gray-400 hover:text-primary-500 rounded flex-shrink-0"
                                title="Edit"
                              >
                                <PenTool className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const current = settings.preferences?.webMailServices || DEFAULT_WEB_MAIL_SERVICES;
                                  const updated = current.filter((s) => s.id !== svc.id);
                                  await updatePreferences({ webMailServices: updated });
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded flex-shrink-0"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {editingWebMailId === 'new' ? (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                      <input
                        type="text"
                        value={webMailForm.name}
                        onChange={(e) => setWebMailForm({ ...webMailForm, name: e.target.value })}
                        placeholder="Service name (e.g. Company Mail)"
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={webMailForm.composeUrl}
                        onChange={(e) => setWebMailForm({ ...webMailForm, composeUrl: e.target.value })}
                        placeholder="https://mail.example.com/compose?to={to}&subject={subject}&body={body}"
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-xs"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditingWebMailId(null); setWebMailForm({ name: '', composeUrl: '' }); }}
                          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!webMailForm.name.trim() || !webMailForm.composeUrl.trim()) return;
                            const current = settings.preferences?.webMailServices || DEFAULT_WEB_MAIL_SERVICES;
                            const id = webMailForm.name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
                            await updatePreferences({
                              webMailServices: [...current, { id, name: webMailForm.name.trim(), composeUrl: webMailForm.composeUrl.trim() }],
                            });
                            setEditingWebMailId(null);
                            setWebMailForm({ name: '', composeUrl: '' });
                          }}
                          className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingWebMailId('new'); setWebMailForm({ name: '', composeUrl: '' }); }}
                      className="mt-3 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add web mail service
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await updatePreferences({ webMailServices: DEFAULT_WEB_MAIL_SERVICES });
                      setEditingWebMailId(null);
                    }}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Reset to defaults
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Templates Tab — Signatures & Placeholders */}
          {activeTab === 'templates' && (
            <div>
              <div className="space-y-6">

                {/* Signatures */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">Signatures</h3>
                    <button
                      onClick={() => setSignatureModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    The default signature is used in templates via {'{{ signature }}'}
                  </p>

                  {(settings.profile?.signatures || []).length > 0 ? (
                    <div className="space-y-2">
                      {(settings.profile?.signatures || []).map((sig: SavedSignature) => {
                        const isDefault = sig.id === settings.profile?.defaultSignatureId;
                        return (
                          <div
                            key={sig.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isDefault
                                ? 'border-primary-300 dark:border-primary-700 bg-[var(--primary-tint-10)] dark:bg-[var(--primary-tint-10)]'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                            }`}
                          >
                            <img
                              src={sig.dataUrl}
                              alt={sig.name}
                              className="h-10 max-w-[140px] object-contain"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                {sig.name}
                              </div>
                              {isDefault && (
                                <span className="text-[10px] text-primary-600 dark:text-primary-400">Default</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {!isDefault && (
                                <button
                                  onClick={async () => {
                                    await updateSettings({
                                      profile: { ...settings.profile, defaultSignatureId: sig.id },
                                    });
                                    toast.success('Default signature set');
                                  }}
                                  title="Set as default"
                                  className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isDefault && (
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 mx-1" />
                              )}
                              <button
                                onClick={async () => {
                                  const sigs = (settings.profile?.signatures || []).filter(
                                    (s: SavedSignature) => s.id !== sig.id
                                  );
                                  const newDefault =
                                    sig.id === settings.profile?.defaultSignatureId
                                      ? sigs[0]?.id
                                      : settings.profile?.defaultSignatureId;
                                  await updateSettings({
                                    profile: {
                                      ...settings.profile,
                                      signatures: sigs,
                                      defaultSignatureId: newDefault,
                                    },
                                  });
                                  toast.success('Signature removed');
                                }}
                                title="Remove"
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => setSignatureModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-3 w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <PenTool className="w-4 h-4" />
                      Create your first signature
                    </button>
                  )}

                  <SignatureModal
                    isOpen={signatureModalOpen}
                    onClose={() => setSignatureModalOpen(false)}
                    onInsert={async (dataUrl) => {
                      const newSig: SavedSignature = {
                        id: crypto.randomUUID(),
                        name: `Signature ${(settings.profile?.signatures || []).length + 1}`,
                        dataUrl,
                        createdAt: new Date().toISOString(),
                      };
                      const sigs = [...(settings.profile?.signatures || []), newSig];
                      const defaultId = settings.profile?.defaultSignatureId || newSig.id;
                      await updateSettings({
                        profile: {
                          ...settings.profile,
                          signatures: sigs,
                          defaultSignatureId: defaultId,
                        },
                      });
                      toast.success('Signature saved');
                    }}
                  />
                </div>

                {/* Template Placeholders */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                    Placeholders
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Set default values for placeholders used in templates. These values are used when rendering previews and sending messages.
                  </p>

                  {/* Prompt on Compose toggle */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Ask for values while composing
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Prompt to fill in placeholder values before sending
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const current = settings.preferences?.placeholders;
                        await updatePreferences({
                          placeholders: {
                            defaults: current?.defaults || DEFAULT_PLACEHOLDER_DEFAULTS,
                            promptOnCompose: !(current?.promptOnCompose ?? false),
                          },
                        });
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings.preferences?.placeholders?.promptOnCompose
                          ? 'bg-primary-600'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.preferences?.placeholders?.promptOnCompose ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grouped placeholders */}
                  {(Object.entries(PLACEHOLDER_GROUPS) as [PlaceholderGroup, { label: string; description: string }][]).map(([groupKey, groupInfo]) => {
                    const placeholders = (settings.preferences?.placeholders?.defaults || DEFAULT_PLACEHOLDER_DEFAULTS)
                      .filter((p) => p.group === groupKey);
                    if (placeholders.length === 0 && groupKey !== 'custom') return null;

                    return (
                      <div key={groupKey} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {groupInfo.label}
                            </h4>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{groupInfo.description}</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {placeholders.map((ph) => (
                            <div
                              key={ph.key}
                              className="flex items-center gap-3 p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 group"
                            >
                              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded font-mono min-w-[100px]">
                                {'{{ '}{ph.key}{' }}'}
                              </code>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
                                {ph.label}
                              </span>
                              {ph.key === 'signature' ? (
                                /* Signature placeholder — shows the default signature preview */
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const sigs = settings.profile?.signatures || [];
                                    const defaultSig = sigs.find(s => s.id === settings.profile?.defaultSignatureId) || sigs[0];
                                    return defaultSig ? (
                                      <img src={defaultSig.dataUrl} alt={defaultSig.name} className="h-6 max-w-[80px] object-contain" />
                                    ) : (
                                      <span className="text-xs text-gray-400 dark:text-gray-600 italic">No signature</span>
                                    );
                                  })()}
                                  <button
                                    onClick={() => setSignatureModalOpen(true)}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Add new signature"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : editingPlaceholder === ph.key ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={placeholderForm.defaultValue}
                                    onChange={(e) => setPlaceholderForm({ ...placeholderForm, defaultValue: e.target.value })}
                                    className="w-40 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="Default value..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const allDefaults = settings.preferences?.placeholders?.defaults || DEFAULT_PLACEHOLDER_DEFAULTS;
                                        const updated = allDefaults.map((d) =>
                                          d.key === ph.key ? { ...d, defaultValue: placeholderForm.defaultValue } : d
                                        );
                                        updatePreferences({
                                          placeholders: {
                                            ...settings.preferences?.placeholders,
                                            defaults: updated,
                                            promptOnCompose: settings.preferences?.placeholders?.promptOnCompose ?? false,
                                          },
                                        });
                                        setEditingPlaceholder(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingPlaceholder(null);
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const allDefaults = settings.preferences?.placeholders?.defaults || DEFAULT_PLACEHOLDER_DEFAULTS;
                                      const updated = allDefaults.map((d) =>
                                        d.key === ph.key ? { ...d, defaultValue: placeholderForm.defaultValue } : d
                                      );
                                      updatePreferences({
                                        placeholders: {
                                          ...settings.preferences?.placeholders,
                                          defaults: updated,
                                          promptOnCompose: settings.preferences?.placeholders?.promptOnCompose ?? false,
                                        },
                                      });
                                      setEditingPlaceholder(null);
                                    }}
                                    className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingPlaceholder(null)}
                                    className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {ph.defaultValue ? (
                                    <span className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded max-w-[120px] truncate">
                                      {ph.defaultValue}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-600 italic">No default</span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingPlaceholder(ph.key);
                                      setPlaceholderForm({ key: ph.key, label: ph.label, defaultValue: ph.defaultValue || '', group: ph.group });
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <PenTool className="w-3 h-3" />
                                  </button>
                                  {!ph.isBuiltIn && (
                                    <button
                                      onClick={async () => {
                                        const allDefaults = settings.preferences?.placeholders?.defaults || DEFAULT_PLACEHOLDER_DEFAULTS;
                                        const updated = allDefaults.filter((d) => d.key !== ph.key);
                                        await updatePreferences({
                                          placeholders: {
                                            ...settings.preferences?.placeholders,
                                            defaults: updated,
                                            promptOnCompose: settings.preferences?.placeholders?.promptOnCompose ?? false,
                                          },
                                        });
                                      }}
                                      className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Add custom placeholder (only for Custom group) */}
                        {groupKey === 'custom' && (
                          <>
                            {editingPlaceholder === 'new-custom' ? (
                              <div className="mt-2 p-3 bg-white dark:bg-gray-900 rounded-lg border border-primary-300 dark:border-primary-700 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={placeholderForm.key}
                                    onChange={(e) => setPlaceholderForm({ ...placeholderForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                                    className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="key_name"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={placeholderForm.label}
                                    onChange={(e) => setPlaceholderForm({ ...placeholderForm, label: e.target.value })}
                                    className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="Description"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={placeholderForm.defaultValue}
                                  onChange={(e) => setPlaceholderForm({ ...placeholderForm, defaultValue: e.target.value })}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  placeholder="Default value (optional)"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      if (!placeholderForm.key.trim()) return;
                                      const allDefaults = settings.preferences?.placeholders?.defaults || DEFAULT_PLACEHOLDER_DEFAULTS;
                                      if (allDefaults.some((d) => d.key === placeholderForm.key)) {
                                        toast.error('Duplicate key', 'A placeholder with this key already exists');
                                        return;
                                      }
                                      const newPlaceholder: PlaceholderDefault = {
                                        key: placeholderForm.key.trim(),
                                        label: placeholderForm.label.trim() || placeholderForm.key.trim(),
                                        group: 'custom',
                                        defaultValue: placeholderForm.defaultValue.trim(),
                                        isBuiltIn: false,
                                      };
                                      await updatePreferences({
                                        placeholders: {
                                          defaults: [...allDefaults, newPlaceholder],
                                          promptOnCompose: settings.preferences?.placeholders?.promptOnCompose ?? false,
                                        },
                                      });
                                      setEditingPlaceholder(null);
                                      setPlaceholderForm({ key: '', label: '', defaultValue: '', group: 'custom' });
                                    }}
                                    className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPlaceholder(null);
                                      setPlaceholderForm({ key: '', label: '', defaultValue: '', group: 'custom' });
                                    }}
                                    className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingPlaceholder('new-custom');
                                  setPlaceholderForm({ key: '', label: '', defaultValue: '', group: 'custom' });
                                }}
                                className="mt-2 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                              >
                                <Plus className="w-4 h-4" />
                                Add custom placeholder
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Features
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Toggle features on or off. Disabled features are hidden from the sidebar.
                </p>
              </div>

              <div className="space-y-6">
                {SETUP_FEATURE_GROUPS.map(group => (
                  <div key={group.name}>
                    <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                      {group.name}
                    </h3>
                    <div className="space-y-1">
                      {group.features.map(feature => {
                        const featureIcons: Record<string, React.ReactNode> = {
                          Send: <Send className="w-4 h-4" />,
                          FileText: <FileText className="w-4 h-4" />,
                          Zap: <Zap className="w-4 h-4" />,
                          Clock: <Clock className="w-4 h-4" />,
                          History: <History className="w-4 h-4" />,
                          Users: <Users className="w-4 h-4" />,
                          Calendar: <Calendar className="w-4 h-4" />,
                          CheckSquare: <CheckSquare className="w-4 h-4" />,
                          Bell: <Bell className="w-4 h-4" />,
                          StickyNote: <StickyNote className="w-4 h-4" />,
                          FileUp: <FileUp className="w-4 h-4" />,
                          DollarSign: <DollarSign className="w-4 h-4" />,
                          Calculator: <Calculator className="w-4 h-4" />,
                          Activity: <Activity className="w-4 h-4" />,
                          Timer: <Timer className="w-4 h-4" />,
                          Workflow: <Workflow className="w-4 h-4" />,
                        };
                        const isEnabled = settings.enabledFeatures?.[feature.href] !== false;
                        return (
                          <button
                            key={feature.href}
                            onClick={async () => {
                              const current = settings.enabledFeatures || {};
                              await updateSettings({
                                enabledFeatures: { ...current, [feature.href]: !isEnabled },
                              });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isEnabled
                                ? 'bg-primary-100 dark:bg-[var(--primary-tint-20)] text-primary-600 dark:text-primary-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                            }`}>
                              {featureIcons[feature.icon]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {feature.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {feature.description}
                              </div>
                            </div>
                            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                              isEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                            }`}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage reminders and notification sounds
                </p>
              </div>

              <div className="space-y-6">
                {/* Notification Sounds */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Notification Sounds
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Choose a sound for each notification type
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {([
                      { type: 'reminders' as NotificationSoundType, label: 'General Reminders', description: 'Follow-ups, tasks, and custom reminders' },
                      { type: 'scheduled' as NotificationSoundType, label: 'Scheduled Messages', description: 'When a scheduled message is sent' },
                    ] as const).map(({ type, label, description }) => {
                      const currentSound = settings.preferences?.notificationSounds?.[type] || 'default';
                      const customPath = settings.preferences?.customSoundPaths?.[type];
                      return (
                        <div key={type} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={currentSound}
                              onChange={async (e) => {
                                const value = e.target.value as NotificationSound;
                                const updated = {
                                  ...settings.preferences?.notificationSounds,
                                  [type]: value,
                                };
                                await updatePreferences({ notificationSounds: updated as any });
                              }}
                              className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                              {SOUND_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => playNotificationSound(currentSound, customPath)}
                              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                              title="Test sound"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            {currentSound === 'custom' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const path = await window.envoy.sounds.upload(type);
                                    if (path) {
                                      const updated = {
                                        ...settings.preferences?.customSoundPaths,
                                        [type]: path,
                                      };
                                      await updatePreferences({ customSoundPaths: updated });
                                      toast.success('Sound uploaded', 'Custom sound has been set');
                                    }
                                  } catch {
                                    toast.error('Upload failed', 'Could not upload sound file');
                                  }
                                }}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-[var(--primary-tint-20)] rounded-lg transition-colors"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Upload
                              </button>
                            )}
                          </div>
                          {currentSound === 'custom' && customPath && (
                            <div className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">
                              {customPath.split(/[/\\]/).pop()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vibration Settings (Mobile/Tablet) */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Vibration
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Vibration patterns for mobile and tablet devices
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {([
                      { type: 'reminders' as NotificationSoundType, label: 'General Reminders', description: 'Follow-ups, tasks, and custom reminders' },
                      { type: 'medical' as NotificationSoundType, label: 'Medical Reminders', description: 'Medication and health-related alerts' },
                      { type: 'scheduled' as NotificationSoundType, label: 'Scheduled Messages', description: 'When a scheduled message is sent' },
                    ] as const).map(({ type, label, description }) => {
                      const currentPattern = settings.preferences?.notificationVibration?.[type] || 'default';
                      return (
                        <div key={`vib-${type}`} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                            </div>
                          </div>
                          <select
                            value={currentPattern}
                            onChange={async (e) => {
                              const value = e.target.value as VibrationPattern;
                              const updated = {
                                ...settings.preferences?.notificationVibration,
                                [type]: value,
                              };
                              await updatePreferences({ notificationVibration: updated as any });
                            }}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            {VIBRATION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label} — {opt.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Safety Tab */}
          {activeTab === 'safety' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Safety
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Control confirmations and safety features
                </p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Confirm before sending</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Show confirmation dialog</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmBeforeSend}
                    onChange={(e) => {
                      updateSettings({ confirmBeforeSend: e.target.checked });
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Confirm bulk sends</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Extra confirmation for multiple recipients</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmBulkSend}
                    onChange={(e) => {
                      updateSettings({ confirmBulkSend: e.target.checked });
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </label>

                <div className="flex items-center justify-between p-4 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Bulk threshold</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Recipients that trigger confirmation</div>
                  </div>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={settings.bulkSendThreshold}
                    onChange={(e) => updateSettings({ bulkSendThreshold: parseInt(e.target.value) || 5 })}
                    className="w-16 px-2 py-1 text-sm text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <label className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Sensitive data detection</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Highlight amounts, account numbers</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sensitiveDataDetection}
                    onChange={(e) => {
                      updateSettings({ sensitiveDataDetection: e.target.checked });
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </label>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-300 text-sm">Local-first privacy</div>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      All data stays on your device. Nothing is sent externally unless you configure integrations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Appearance
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Customize how Envoy looks
                </p>
              </div>

              <div className="space-y-8">
                {/* Theme */}
                <div>
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Theme</h3>
                  <div className="flex gap-2">
                    {[
                      { mode: 'light' as const, icon: Sun, label: 'Light' },
                      { mode: 'dark' as const, icon: Moon, label: 'Dark' },
                      { mode: 'system' as const, icon: Monitor, label: 'System' },
                    ].map(({ mode, icon: Icon, label }) => (
                      <button
                        key={mode}
                        onClick={() => setThemeMode(mode)}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          themeSettings.mode === mode
                            ? 'border-primary-500 bg-primary-50 dark:bg-[var(--primary-tint-20)]'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${themeSettings.mode === mode ? 'text-primary-600' : 'text-gray-400'}`} />
                        <span className={`text-sm ${themeSettings.mode === mode ? 'text-primary-700 dark:text-primary-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Accent Color</h3>
                  <div className="flex gap-2">
                    {(Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; primary: string }][]).map(
                      ([color, { name, primary }]) => (
                        <button
                          key={color}
                          onClick={() => setAccentColor(color)}
                          className={`relative w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                            themeSettings.accentColor === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900' : ''
                          }`}
                          style={{ backgroundColor: primary }}
                          title={name}
                        >
                          {themeSettings.accentColor === color && (
                            <Check className="w-3.5 h-3.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Font Size</h3>
                  <div className="flex gap-2">
                    {[
                      { size: 'small' as FontSize, label: 'Small' },
                      { size: 'medium' as FontSize, label: 'Medium' },
                      { size: 'large' as FontSize, label: 'Large' },
                    ].map(({ size, label }) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`flex-1 p-2.5 rounded-lg border-2 transition-all ${
                          themeSettings.fontSize === size
                            ? 'border-primary-500 bg-primary-50 dark:bg-[var(--primary-tint-20)]'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className={`text-sm ${themeSettings.fontSize === size ? 'text-primary-700 dark:text-primary-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accessibility */}
                <div>
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Accessibility</h3>
                  <div className="space-y-1">
                    <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Reduce motion</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Minimize animations</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={themeSettings.reducedMotion}
                        onChange={(e) => setReducedMotion(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Compact mode</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Reduce spacing for density</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={themeSettings.compactMode}
                        onChange={(e) => setCompactMode(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Integrations
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Connect external services
                </p>
              </div>

              <div className="space-y-2">
                {INTEGRATIONS.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 ${integration.color} rounded-lg flex items-center justify-center text-white`}>
                        {integration.icon}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {integration.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {integration.description}
                        </div>
                      </div>
                    </div>
                    {integration.status === 'available' ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="w-3.5 h-3.5" />
                        Available
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Coming soon</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Microsoft Teams Configuration — hidden for now, backend ready */}

              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                  Request an integration
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Need a specific service? Let us know.
                </p>
                <button className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium flex items-center gap-1">
                  Submit request
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Feedback
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Help us improve Envoy
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setFeedbackType('feature')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-[var(--primary-tint-10)] dark:hover:bg-[var(--primary-tint-10)] transition-all group"
                >
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      Suggest a feature
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Share ideas for new functionality
                    </div>
                  </div>
                  <Send className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto group-hover:text-primary-500 transition-colors" />
                </button>

                <button
                  onClick={() => setFeedbackType('bug')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-[var(--primary-tint-10)] dark:hover:bg-[var(--primary-tint-10)] transition-all group"
                >
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Bug className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      Report a bug
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Let us know if something isn't working
                    </div>
                  </div>
                  <Send className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto group-hover:text-primary-500 transition-colors" />
                </button>

                <button
                  onClick={() => setFeedbackType('general')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-[var(--primary-tint-10)] dark:hover:bg-[var(--primary-tint-10)] transition-all group"
                >
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      General feedback
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Share your thoughts and experience
                    </div>
                  </div>
                  <Send className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto group-hover:text-primary-500 transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  System
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Monitor components and status
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Python Engine</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Template rendering</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${pythonStatus.running ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={`text-xs ${pythonStatus.running ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {pythonStatus.running ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                    <button
                      onClick={restartPython}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                      title="Restart"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Database</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">MySQL local</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">Version</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Envoy Desktop</div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">1.0.0</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                  Data Storage
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  All data stored locally. Nothing synced externally.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add email account
              </h2>
              <button
                onClick={() => setShowAddAccount(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {accountError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {accountError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account name
                </label>
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="input text-sm"
                  placeholder="e.g. Work Gmail"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From name
                  </label>
                  <input
                    type="text"
                    value={accountForm.fromName}
                    onChange={(e) => setAccountForm({ ...accountForm, fromName: e.target.value })}
                    className="input text-sm"
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From email
                  </label>
                  <input
                    type="email"
                    value={accountForm.fromEmail}
                    onChange={(e) => setAccountForm({ ...accountForm, fromEmail: e.target.value })}
                    className="input text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SMTP host
                  </label>
                  <input
                    type="text"
                    value={accountForm.host}
                    onChange={(e) => setAccountForm({ ...accountForm, host: e.target.value })}
                    className="input text-sm"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={accountForm.port}
                    onChange={(e) => setAccountForm({ ...accountForm, port: parseInt(e.target.value) || 587 })}
                    className="input text-sm"
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={accountForm.user}
                    onChange={(e) => setAccountForm({ ...accountForm, user: e.target.value })}
                    className="input text-sm"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    className="input text-sm"
                    placeholder="App password or SMTP password"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accountForm.secure}
                    onChange={(e) => setAccountForm({ ...accountForm, secure: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Use SSL/TLS
                </label>
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accountForm.isDefault}
                    onChange={(e) => setAccountForm({ ...accountForm, isDefault: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Set as default
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddAccount(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={addingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={addingAccount}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors"
              >
                {addingAccount ? 'Adding...' : 'Add account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {feedbackType === 'feature' && (
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
                {feedbackType === 'bug' && (
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                )}
                {feedbackType === 'general' && (
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                )}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {feedbackType === 'feature' && 'Suggest a Feature'}
                  {feedbackType === 'bug' && 'Report a Bug'}
                  {feedbackType === 'general' && 'General Feedback'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setFeedbackType(null);
                  setFeedbackText('');
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {feedbackType === 'feature' && 'Describe the feature you\'d like to see'}
                {feedbackType === 'bug' && 'Describe the issue you encountered'}
                {feedbackType === 'general' && 'Share your thoughts'}
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  feedbackType === 'feature'
                    ? 'I would like to be able to...'
                    : feedbackType === 'bug'
                    ? 'When I try to... it shows...'
                    : 'I think the app could...'
                }
                rows={5}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Your default mail app will open so you can review before sending.
              </p>
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setFeedbackType(null);
                  setFeedbackText('');
                }}
                disabled={submittingFeedback}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedbackText.trim() || submittingFeedback}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submittingFeedback ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
