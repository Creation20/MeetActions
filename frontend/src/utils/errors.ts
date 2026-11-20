import { Alert } from 'react-native';

/**
 * The last line of defence before an error reaches a human.
 *
 * Anything thrown inside the app — a dropped connection, a 500, a JSON parse
 * failure, an SDK exception — can end up in an Alert. Raw values like
 * "Network request failed", "JSON Parse error: Unexpected token <" or a Mongoose
 * validation string tell the user nothing they can act on. Everything user-facing
 * goes through here first.
 */

const FALLBACK = 'Something went wrong. Please try again.';

/** Errors the app raises for control flow, which should never be shown as an alert. */
export const isSilentError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return msg === 'SESSION_EXPIRED' || msg === 'PREMIUM_REQUIRED';
};

export const friendlyError = (error: unknown, fallback: string = FALLBACK): string => {
  const raw = (error instanceof Error ? error.message : String(error ?? '')).trim();
  if (!raw) return fallback;

  // Connectivity: the most common failure, and the one users can actually fix.
  if (/network request failed|failed to fetch|timeout|timed out|econnrefused|network error/i.test(raw)) {
    return "We can't reach the server. Check your internet connection and try again.";
  }

  // The server sent HTML (a proxy/tunnel error page) instead of JSON.
  if (/JSON Parse error|Unexpected token|Unexpected end of (JSON )?input/i.test(raw)) {
    return "We couldn't reach the server. Please try again in a moment.";
  }

  if (/PREMIUM_REQUIRED/i.test(raw)) {
    return 'This feature is part of MeetActions Pro.';
  }

  // Anything that still looks like machine output — stack frames, error codes,
  // driver/model names — is not shown. If it doesn't read like a sentence written
  // for a person, the user gets the fallback and the detail goes to the console.
  const looksTechnical =
    /\bat\s+\w+\.\w+|Error:|Exception|\bstack\b|[{}[\]<>]|\b[A-Z]{2,}_[A-Z_]+\b|https?:\/\//.test(raw) ||
    /^[a-z]+([A-Z][a-z]+)+$/.test(raw) ||
    raw.length > 160;

  if (looksTechnical) {
    if (__DEV__) console.warn('[suppressed technical error]', raw);
    return fallback;
  }

  return raw;
};

/**
 * Show an error to the user. Silent errors (expired session, paywall) are swallowed
 * because the app already handles them by navigating.
 */
export const showError = (error: unknown, title = 'Something went wrong', fallback?: string): void => {
  if (isSilentError(error)) return;
  if (__DEV__) console.warn(`[${title}]`, error);
  Alert.alert(title, friendlyError(error, fallback));
};
