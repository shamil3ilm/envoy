import * as Sentry from '@sentry/react-native';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
