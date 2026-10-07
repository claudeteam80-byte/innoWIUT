/** Telegram handle or link → https://t.me/... ; null if unusable. */
export function telegramUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(t\.me|telegram\.me)\//i.test(raw)) return `https://${raw}`;
  const handle = raw.replace(/^@/, '');
  return /^[A-Za-z0-9_]{4,32}$/.test(handle) ? `https://t.me/${handle}` : null;
}

export function externalUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

interface ContactFields {
  email: string | null;
  telegram: string | null;
  linkedin_url: string | null;
  contact_url: string | null;
}

/** Best way to reach a mentor: email, then Telegram, then LinkedIn/other link. */
export function primaryContact(
  mentor: ContactFields,
): { href: string; label: string; external: boolean } | null {
  if (mentor.email) return { href: `mailto:${mentor.email}`, label: 'Email', external: false };
  const telegram = telegramUrl(mentor.telegram);
  if (telegram) return { href: telegram, label: 'Telegram', external: true };
  const linkedin = externalUrl(mentor.linkedin_url);
  if (linkedin) return { href: linkedin, label: 'LinkedIn', external: true };
  const other = externalUrl(mentor.contact_url);
  if (other) return { href: other, label: 'Contact link', external: true };
  return null;
}
