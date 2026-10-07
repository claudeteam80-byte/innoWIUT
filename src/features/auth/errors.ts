import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please verify your email before signing in.',
  user_already_exists: 'An account with this email already exists. Try signing in.',
  email_exists: 'An account with this email already exists. Try signing in.',
  weak_password: 'Choose a stronger password.',
  same_password: 'Choose a password that is different from your current one.',
  otp_expired: 'That code is invalid or has expired. Request a new one.',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  signup_disabled: 'Founder sign up is currently closed.',
  user_banned: 'This account has been disabled. Contact the innoWIUT team.',
};

export const ADMIN_ACCESS_DENIED_MESSAGE =
  'This account does not have administrator access. Admin accounts are created internally by innoWIUT staff.';

export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Check your connection and try again.";

export function getAuthErrorCode(error: unknown): string | undefined {
  return isAuthError(error) ? error.code : undefined;
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (isAuthRetryableFetchError(error)) return NETWORK_ERROR_MESSAGE;
  const code = getAuthErrorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return fallback;
}
