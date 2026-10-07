import { describe, expect, it } from 'vitest';
import { primaryContact, telegramUrl } from './contact';

describe('telegramUrl', () => {
  it.each([
    ['@aziz_k', 'https://t.me/aziz_k'],
    ['aziz_k', 'https://t.me/aziz_k'],
    ['t.me/aziz_k', 'https://t.me/aziz_k'],
    ['https://t.me/aziz_k', 'https://t.me/aziz_k'],
    ['', null],
    ['no spaces allowed', null],
  ])('%j → %j', (input, expected) => {
    expect(telegramUrl(input)).toBe(expected);
  });
});

describe('primaryContact', () => {
  const none = { email: null, telegram: null, linkedin_url: null, contact_url: null };

  it('prefers email, then Telegram, then LinkedIn', () => {
    expect(primaryContact({ ...none, email: 'm@wiut.uz', telegram: '@m_mentor' })?.href).toBe(
      'mailto:m@wiut.uz',
    );
    expect(
      primaryContact({ ...none, telegram: '@m_mentor', linkedin_url: 'linkedin.com/in/m' })?.href,
    ).toBe('https://t.me/m_mentor');
    expect(primaryContact({ ...none, linkedin_url: 'linkedin.com/in/m' })?.href).toBe(
      'https://linkedin.com/in/m',
    );
  });

  it('returns null without contact details', () => {
    expect(primaryContact(none)).toBeNull();
  });
});
