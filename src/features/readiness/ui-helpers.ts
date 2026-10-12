// Non-component helpers shared by the readiness screens (kept out of component files).
import type { InterviewStatus, ReadinessStateRow } from '@/domain/readiness';
import type { ProfileGroup } from './schemas';

export const INTERVIEW_STATUS: Record<
  InterviewStatus,
  { label: string; tone: 'neutral' | 'blue' | 'positive' }
> = {
  not_required: { label: 'Not required', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  completed: { label: 'Completed', tone: 'positive' },
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** ISO time → the value a datetime-local input shows (local time, minutes). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Validates the admin's interview form; returns the RPC input or field errors. */
export function parseInterview(values: {
  status: InterviewStatus;
  scheduledAt: string;
  location: string;
  note: string;
}):
  | { ok: true; scheduledAt: string | null; location: string | null; note: string | null }
  | { ok: false; errors: Partial<Record<'scheduledAt' | 'location' | 'note', string>> } {
  const errors: Partial<Record<'scheduledAt' | 'location' | 'note', string>> = {};
  const date = values.scheduledAt ? new Date(values.scheduledAt) : null;
  if (date && Number.isNaN(date.getTime())) errors.scheduledAt = 'Choose a valid date and time.';
  const location = values.location.trim();
  if (location.length > 500) errors.location = 'Use 500 characters or fewer.';
  const note = values.note.trim();
  if (note.length > 2000) errors.note = 'Use 2000 characters or fewer.';
  if (values.status !== 'not_required') {
    if (!date) errors.scheduledAt = 'Choose the date and time.';
    if (!location) errors.location = 'Add a place or a meeting link.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const keep = values.status !== 'not_required';
  return {
    ok: true,
    scheduledAt: keep && date ? date.toISOString() : null,
    location: keep ? location : null,
    note: note || null,
  };
}

/** Where a requirement is edited: its own dialog, a profile group, metrics or the profile page. */
export type EditTarget =
  | { kind: 'requirement'; row: ReadinessStateRow }
  | { kind: 'profile'; group: ProfileGroup }
  | { kind: 'metrics' }
  | { kind: 'startup_profile' };

export function editTarget(row: ReadinessStateRow): EditTarget {
  switch (row.requirement_key) {
    case 'business_type':
    case 'current_product_stage':
      return { kind: 'profile', group: 'company' };
    case 'primary_investor_metrics':
      return { kind: 'metrics' };
    case 'founder_experience':
    case 'founder_commitment':
      return { kind: 'profile', group: 'team' };
    case 'team_details':
      return { kind: 'startup_profile' };
  }
  if (row.section === 'company') return { kind: 'startup_profile' };
  if (row.section === 'fundraising') return { kind: 'profile', group: 'fundraising' };
  if (row.section === 'legal_operations') return { kind: 'profile', group: 'legal' };
  return { kind: 'requirement', row };
}
