import { useState, useEffect } from 'react';
import {
  Mail,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  FileText,
  ChevronRight,
  X,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Contact, AuditLog, ScheduledMessage, UserActivityLog } from '@shared/types';
import { useDateTimeFormat } from '../../hooks/useDateTimeFormat';

interface ContactTimelineProps {
  contact: Contact;
  onClose: () => void;
}

interface TimelineEvent {
  id: string;
  type: 'email_sent' | 'email_failed' | 'whatsapp' | 'scheduled' | 'activity';
  title: string;
  description?: string;
  status?: 'success' | 'failed' | 'pending';
  timestamp: Date;
  details?: Record<string, unknown>;
}

export default function ContactTimeline({ contact, onClose }: ContactTimelineProps) {
  const { fmtTime, fmtFullDate } = useDateTimeFormat();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [contact.id]);

  async function loadTimeline() {
    setLoading(true);
    try {
      const allEvents: TimelineEvent[] = [];

      // Load audit logs for this contact
      const auditLogs = await window.envoy.audit.list({
        search: contact.email || contact.name,
      });

      // Filter audit logs that match this contact
      const contactAuditLogs = auditLogs.filter(
        (log: AuditLog) =>
          log.recipientAddress === contact.email ||
          log.recipientName === contact.name ||
          log.recipientId === contact.id
      );

      for (const log of contactAuditLogs) {
        allEvents.push({
          id: log.id,
          type: log.channel === 'email' ? (log.status === 'failed' ? 'email_failed' : 'email_sent') : 'whatsapp',
          title: log.channel === 'email' ? `Email: ${log.subject || 'No subject'}` : 'WhatsApp Message',
          description: log.bodyPreview,
          status: log.status === 'sent' || log.status === 'delivered' ? 'success' : log.status === 'failed' ? 'failed' : 'pending',
          timestamp: new Date(log.sentAt),
          details: {
            templateName: log.templateName,
            attachments: log.attachments,
          },
        });
      }

      // Load scheduled messages for this contact
      const scheduledMessages = await window.envoy.schedule.list({});
      const contactScheduled = scheduledMessages.filter(
        (msg: ScheduledMessage) => msg.recipientIds.includes(contact.id)
      );

      for (const msg of contactScheduled) {
        const template = await window.envoy.templates.get(msg.templateId);
        allEvents.push({
          id: msg.id,
          type: 'scheduled',
          title: `Scheduled: ${template?.name || 'Unknown Template'}`,
          description: `${msg.channel} message scheduled for ${format(new Date(msg.scheduledFor), 'PPp')}`,
          status: msg.status === 'sent' ? 'success' : msg.status === 'failed' ? 'failed' : 'pending',
          timestamp: new Date(msg.createdAt),
          details: {
            scheduledFor: msg.scheduledFor,
            status: msg.status,
          },
        });
      }

      // Load activity logs related to this contact
      const activityResult = await window.envoy.activity.list({
        entityId: contact.id,
        limit: 50,
      });

      for (const log of activityResult.logs) {
        // Skip if we already have this event from audit logs
        if (allEvents.some((e) => e.id === log.id)) continue;

        allEvents.push({
          id: log.id,
          type: 'activity',
          title: formatActivityAction(log.action),
          description: log.description,
          timestamp: new Date(log.createdAt),
          details: log.details,
        });
      }

      // Sort by timestamp descending
      allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatActivityAction(action: string): string {
    const actionMap: Record<string, string> = {
      contact_created: 'Contact created',
      contact_updated: 'Contact updated',
      email_sent: 'Email sent',
      email_failed: 'Email failed',
      whatsapp_sent: 'WhatsApp message',
      message_scheduled: 'Message scheduled',
    };
    return actionMap[action] || action.replace(/_/g, ' ');
  }

  function getEventIcon(event: TimelineEvent) {
    switch (event.type) {
      case 'email_sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'email_failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'scheduled':
        return event.status === 'pending' ? (
          <Clock className="w-4 h-4 text-yellow-500" />
        ) : event.status === 'success' ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-500" />
        );
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  }

  function getEventColor(event: TimelineEvent) {
    switch (event.status) {
      case 'success':
        return 'border-green-200 dark:border-green-800';
      case 'failed':
        return 'border-red-200 dark:border-red-800';
      case 'pending':
        return 'border-yellow-200 dark:border-yellow-800';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-[var(--primary-tint-30)] rounded-full flex items-center justify-center">
              <span className="text-primary-700 dark:text-primary-300 font-medium">
                {contact.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {contact.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Activity Timeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading timeline...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No activity yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Send a message to this contact to start building their timeline.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

              {/* Events */}
              <div className="space-y-4">
                {events.map((event, index) => (
                  <div key={event.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-2 w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                      {getEventIcon(event)}
                    </div>

                    {/* Event card */}
                    <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border-l-4 ${getEventColor(event)}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {event.title}
                          </h4>
                          {event.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          {event.details?.templateName && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                              <FileText className="w-3 h-3" />
                              Template: {String(event.details.templateName)}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          <div>{fmtFullDate(event.timestamp)}</div>
                          <div>{fmtTime(event.timestamp)}</div>
                          <div className="text-gray-400 mt-1">
                            {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                      </div>

                      {/* Scheduled message details */}
                      {event.type === 'scheduled' && event.details?.scheduledFor && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Scheduled for:{' '}
                              {format(new Date(event.details.scheduledFor as string), 'PPp')}
                            </span>
                            {event.details?.status && (
                              <span
                                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                  event.details.status === 'sent'
                                    ? 'bg-green-100 text-green-700'
                                    : event.details.status === 'failed'
                                    ? 'bg-red-100 text-red-700'
                                    : event.details.status === 'cancelled'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {String(event.details.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {event.details?.attachments &&
                        Array.isArray(event.details.attachments) &&
                        event.details.attachments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <FileText className="w-3 h-3" />
                              <span>
                                {event.details.attachments.length} attachment
                                {event.details.attachments.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {events.length} event{events.length !== 1 ? 's' : ''} in timeline
          </span>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
