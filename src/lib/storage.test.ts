import { describe, expect, it, vi } from 'vitest';
import { storagePath, validateImage } from './storage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('validateImage', () => {
  it('accepts PNG, JPG and WebP within the bucket limit', () => {
    expect(validateImage({ type: 'image/png', size: 1024 }, 'startup-logos')).toBeNull();
    expect(
      validateImage({ type: 'image/webp', size: 4 * 1024 * 1024 }, 'update-attachments'),
    ).toBeNull();
  });

  it('rejects other types', () => {
    expect(validateImage({ type: 'image/svg+xml', size: 10 }, 'startup-logos')).toMatch(
      /PNG, JPG or WebP/,
    );
    expect(validateImage({ type: 'application/pdf', size: 10 }, 'update-attachments')).toMatch(
      /PNG/,
    );
  });

  it('rejects files over the bucket limit', () => {
    expect(validateImage({ type: 'image/png', size: 3 * 1024 * 1024 }, 'startup-logos')).toMatch(
      /2 MB/,
    );
    expect(
      validateImage({ type: 'image/png', size: 6 * 1024 * 1024 }, 'update-attachments'),
    ).toMatch(/5 MB/);
  });

  it('rejects empty files', () => {
    expect(validateImage({ type: 'image/png', size: 0 }, 'startup-logos')).toMatch(/empty/);
  });
});

describe('storagePath', () => {
  it('puts the file under the owner folder that storage RLS checks', () => {
    expect(storagePath('startup-1', 'logo', { type: 'image/jpeg' })).toMatch(
      /^startup-1\/logo-[0-9a-f-]{36}\.jpg$/,
    );
  });
});
