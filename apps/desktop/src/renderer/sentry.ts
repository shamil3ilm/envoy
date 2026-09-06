import * as Sentry from '@sentry/electron/renderer';

const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({ dsn });
}
