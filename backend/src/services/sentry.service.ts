import * as Sentry from '@sentry/node';

/**
 * Error tracking is opt-in: with no SENTRY_DSN set (local dev, CI) this is a no-op
 * and nothing is sent anywhere. Import this module before express so Sentry's
 * instrumentation can patch the http layer.
 */
export const isSentryEnabled = Boolean(process.env.SENTRY_DSN);

if (isSentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Sample traces sparingly; transcription requests are long and low-volume.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Meeting audio and transcripts are sensitive — never let request bodies ride along.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
}
