import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
  Workflow,
  CheckSquare,
  UserPlus,
  Send,
  Clock,
  Bell,
  DollarSign,
  ListTodo,
  MessageSquare,
  Zap,
} from 'lucide-react';
import type { AutomationRule, CreateRuleInput, UpdateRuleInput, RuleTrigger, RuleActionType, RuleAction } from '@shared/types';
import { useToast } from '../contexts/ToastContext';
import { useActivityLog } from '../hooks/useActivityLog';

const TRIGGER_OPTIONS: { value: RuleTrigger; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'task_completed', label: 'Task Completed', description: 'When a task is marked as done', icon: <CheckSquare className="w-4 h-4" /> },
  { value: 'contact_created', label: 'Contact Created', description: 'When a new contact is added', icon: <UserPlus className="w-4 h-4" /> },
  { value: 'message_sent', label: 'Message Sent', description: 'When a message is sent', icon: <Send className="w-4 h-4" /> },
  { value: 'message_scheduled', label: 'Message Scheduled', description: 'When a message is scheduled', icon: <Clock className="w-4 h-4" /> },
  { value: 'reminder_due', label: 'Reminder Due', description: 'When a reminder is triggered', icon: <Bell className="w-4 h-4" /> },
  { value: 'expense_created', label: 'Expense Created', description: 'When an expense is logged', icon: <DollarSign className="w-4 h-4" /> },
];

const ACTION_OPTIONS: { value: RuleActionType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'create_task', label: 'Create Task', description: 'Automatically create a new task', icon: <ListTodo className="w-4 h-4" /> },
  { value: 'create_reminder', label: 'Create Reminder', description: 'Set a reminder automatically', icon: <Bell className="w-4 h-4" /> },
  { value: 'compose_message', label: 'Compose Message', description: 'Open compose with pre-filled content', icon: <Send className="w-4 h-4" /> },
  { value: 'log_activity', label: 'Log Activity', description: 'Add an entry to the activity log', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'show_notification', label: 'Show Notification', description: 'Display a notification', icon: <Zap className="w-4 h-4" /> },
];

function getActionConfigFields(actionType: RuleActionType): { key: string; label: string; placeholder: string; type?: string }[] {
  switch (actionType) {
    case 'create_task':
      return [
        { key: 'title', label: 'Task Title', placeholder: 'e.g. Follow up on {trigger}' },
        { key: 'priority', label: 'Priority', placeholder: 'low / medium / high' },
      ];
    case 'create_reminder':
      return [
        { key: 'title', label: 'Reminder Title', placeholder: 'e.g. Review completed task' },
        { key: 'delayMinutes', label: 'Delay (minutes)', placeholder: 'e.g. 30', type: 'number' },
      ];
    case 'compose_message':
      return [
        { key: 'subject', label: 'Subject', placeholder: 'e.g. Follow-up: {trigger}' },
        { key: 'body', label: 'Message Body', placeholder: 'e.g. Hi, just following up on...' },
        { key: 'channel', label: 'Channel', placeholder: 'email / whatsapp / teams' },
      ];
    case 'log_activity':
      return [
        { key: 'description', label: 'Log Message', placeholder: 'e.g. Automation triggered: {trigger}' },
      ];
    case 'show_notification':
      return [
        { key: 'title', label: 'Notification Title', placeholder: 'e.g. Automation Alert' },
        { key: 'message', label: 'Message', placeholder: 'e.g. A task was completed' },
      ];
    default:
      return [];
  }
}

export default function Automations() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const toast = useToast();
  const { log: logActivity } = useActivityLog();

  // Editor state
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<RuleTrigger>('task_completed');
  const [actions, setActions] = useState<RuleAction[]>([{ type: 'create_task', config: {} }]);

  const loadRules = async () => {
    try {
      const result = await window.envoy.rules.list();
      setRules(result);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const resetEditor = () => {
    setName('');
    setTrigger('task_completed');
    setActions([{ type: 'create_task', config: {} }]);
    setEditingRule(null);
    setShowEditor(false);
  };

  const handleCreate = () => {
    resetEditor();
    setShowEditor(true);
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTrigger(rule.trigger);
    setActions(rule.actions.length > 0 ? rule.actions : [{ type: 'create_task', config: {} }]);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (actions.length === 0) {
      toast.error('Please add at least one action');
      return;
    }

    try {
      if (editingRule) {
        const input: UpdateRuleInput = { name: name.trim(), trigger, actions };
        await window.envoy.rules.update(editingRule.id, input);
        toast.success('Rule updated');
        logActivity('settings_updated' as any, 'system', `Updated automation rule: ${name.trim()}`);
      } else {
        const input: CreateRuleInput = { name: name.trim(), trigger, actions, enabled: true };
        await window.envoy.rules.create(input);
        toast.success('Rule created');
        logActivity('settings_updated' as any, 'system', `Created automation rule: ${name.trim()}`);
      }
      resetEditor();
      loadRules();
    } catch (error) {
      toast.error('Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await window.envoy.rules.delete(id);
      toast.success('Rule deleted');
      loadRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await window.envoy.rules.update(rule.id, { enabled: !rule.enabled });
      loadRules();
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const addAction = () => {
    setActions([...actions, { type: 'show_notification', config: {} }]);
  };

  const removeAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: RuleActionType) => {
    const updated = [...actions];
    updated[index] = { type, config: {} };
    setActions(updated);
  };

  const updateActionConfig = (index: number, key: string, value: string) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], config: { ...updated[index].config, [key]: value } };
    setActions(updated);
  };

  const triggerInfo = TRIGGER_OPTIONS.find(t => t.value === trigger);

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Automations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create if-then rules to automate your workflow
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>

        {/* Rules List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : rules.length === 0 && !showEditor ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Workflow className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">No automation rules yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Create rules like "When a task is completed, create a follow-up reminder"
            </p>
            <button
              onClick={handleCreate}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => {
              const triggerOpt = TRIGGER_OPTIONS.find(t => t.value === rule.trigger);
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    rule.enabled
                      ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{rule.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          rule.enabled
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          {triggerOpt?.icon}
                          When: {triggerOpt?.label || rule.trigger}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">→</span>
                        <span>
                          Then: {rule.actions.map(a => ACTION_OPTIONS.find(o => o.value === a.type)?.label || a.type).join(', ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => handleToggle(rule)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={resetEditor} />
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingRule ? 'Edit Rule' : 'New Automation Rule'}
                  </h2>
                  <button
                    onClick={resetEditor}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Rule Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Follow up on completed tasks"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  {/* Trigger (IF) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded text-xs font-bold mr-1">IF</span>
                      When this happens...
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TRIGGER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setTrigger(opt.value)}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
                            trigger === opt.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className={trigger === opt.value ? 'text-primary-500' : 'text-gray-400'}>{opt.icon}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    {triggerInfo && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{triggerInfo.description}</p>
                    )}
                  </div>

                  {/* Actions (THEN) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded text-xs font-bold mr-1">THEN</span>
                      Do this...
                    </label>
                    <div className="space-y-4">
                      {actions.map((action, idx) => {
                        const actionOpt = ACTION_OPTIONS.find(a => a.value === action.type);
                        const configFields = getActionConfigFields(action.type);
                        return (
                          <div key={idx} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <select
                                value={action.type}
                                onChange={e => updateActionType(idx, e.target.value as RuleActionType)}
                                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                {ACTION_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              {actions.length > 1 && (
                                <button
                                  onClick={() => removeAction(idx)}
                                  className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {actionOpt && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{actionOpt.description}</p>
                            )}
                            {configFields.map(field => (
                              <div key={field.key}>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  {field.label}
                                </label>
                                <input
                                  type={field.type || 'text'}
                                  value={action.config[field.key] || ''}
                                  onChange={e => updateActionConfig(idx, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={addAction}
                      className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add another action
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={resetEditor}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingRule ? 'Save Changes' : 'Create Rule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
