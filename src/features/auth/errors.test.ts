import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage, NETWORK_ERROR_MESSAGE } from './errors';

describe('getAuthErrorMessage', () => {
  it('maps known Supabase auth error codes', () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(getAuthErrorMessage(error, 'fallback')).toBe('Incorrect email or password.');
  });

  it('maps expired codes', () => {
    const error = new AuthApiError('Token has expired or is invalid', 403, 'otp_expired');
    expect(getAuthErrorMessage(error, 'fallback')).toMatch(/invalid or has expired/);
  });

  it('reports network failures', () => {
    expect(getAuthErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0), 'fallback')).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it('uses the fallback for unknown errors without leaking raw messages', () => {
    expect(
      getAuthErrorMessage(new AuthApiError('db exploded', 500, 'unexpected_failure'), 'Try again.'),
    ).toBe('Try again.');
    expect(getAuthErrorMessage(new Error('boom'), 'Try again.')).toBe('Try again.');
  });
});
