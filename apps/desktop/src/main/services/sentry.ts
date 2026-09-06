import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';
import { logger } from './logger';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.ENVOY_SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry disabled (no ENVOY_SENTRY_DSN)');
    return;
  }
  initialized = true;

  Sentry.init({
    dsn,
    release: `envoy@${app.getVersion()}`,
    environment: app.isPackaged ? 'production' : 'development',
    tracesSampleRate: 0.1,
    // Redact anything that looks like a user secret before sending.
    beforeSend(event) {
      if (event.extra) {
        for (const key of Object.keys(event.extra)) {
          if (/password|token|secret|apiKey|api_key/i.test(key)) {
            event.extra[key] = '[redacted]';
          }
        }
      }
      return event;
    },
  });

  logger.info('Sentry initialized');
}
