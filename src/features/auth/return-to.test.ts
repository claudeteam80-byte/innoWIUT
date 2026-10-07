import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo, withReturnTo } from './return-to';

describe('sanitizeReturnTo', () => {
  it('keeps in-area paths with query and hash', () => {
    expect(sanitizeReturnTo('/founder/traction?tab=history#top', '/founder')).toBe(
      '/founder/traction?tab=history#top',
    );
    expect(sanitizeReturnTo('/admin', '/admin')).toBe('/admin');
  });

  it.each([
    null,
    '',
    'founder/dashboard',
    '//evil.example/founder',
    '/\\evil.example',
    'https://evil.example/founder/dashboard',
    '/admin/dashboard',
    '/founderish',
    '/founder/../admin/dashboard',
  ])('rejects %j for the founder area', (value) => {
    expect(sanitizeReturnTo(value, '/founder')).toBeNull();
  });
});

describe('withReturnTo', () => {
  it('encodes the return path', () => {
    expect(withReturnTo('/founder/login', '/founder/updates?x=1')).toBe(
      '/founder/login?returnTo=%2Ffounder%2Fupdates%3Fx%3D1',
    );
  });
});
