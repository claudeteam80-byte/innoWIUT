import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
import { emptyEvidence, parseEvidenceDraft } from './evidence';

const file = (type: string, size = 1000) => ({ type, size, name: 'f' }) as unknown as File;

describe('parseEvidenceDraft', () => {
  it('keeps only the value that proves the type', () => {
    const result = parseEvidenceDraft({
      ...emptyEvidence('link', 'req-1'),
      label: ' Demo video ',
      url: 'loom.com/share/abc',
      text_value: 'ignored',
    });
    expect(result).toEqual({
      ok: true,
      row: {
        evidence_type: 'link',
        label: 'Demo video',
        url: 'https://loom.com/share/abc',
        text_value: null,
        linked_metric_id: null,
        requirement_id: 'req-1',
      },
    });
  });

  it('requires the right value for each type', () => {
    expect(parseEvidenceDraft({ ...emptyEvidence('product_url'), label: 'App' })).toMatchObject({
      ok: false,
      errors: { url: 'Add the link.' },
    });
    expect(
      parseEvidenceDraft({ ...emptyEvidence('customer_feedback'), label: 'Quote' }),
    ).toMatchObject({
      ok: false,
      errors: { text_value: 'Add what the customer said.' },
    });
    expect(parseEvidenceDraft({ ...emptyEvidence('metric'), label: 'Users' })).toMatchObject({
      ok: false,
      errors: { linked_metric_id: 'Choose a traction metric.' },
    });
    expect(parseEvidenceDraft({ ...emptyEvidence('screenshot'), label: 'Shot' })).toMatchObject({
      ok: false,
      errors: { file: 'Choose a screenshot.' },
    });
    expect(parseEvidenceDraft(emptyEvidence('text_note'))).toMatchObject({
      ok: false,
      errors: { label: 'Give this evidence a short label.' },
    });
  });

  it('rejects unsafe links', () => {
    expect(
      parseEvidenceDraft({ ...emptyEvidence('link'), label: 'x', url: 'javascript:alert(1)' }),
    ).toMatchObject({ ok: false });
  });

  it('accepts PDFs as documents but only images as screenshots', () => {
    expect(
      parseEvidenceDraft({
        ...emptyEvidence('document'),
        label: 'Deck',
        file: file('application/pdf'),
      }).ok,
    ).toBe(true);
    expect(
      parseEvidenceDraft({
        ...emptyEvidence('screenshot'),
        label: 'Shot',
        file: file('application/pdf'),
      }),
    ).toMatchObject({ ok: false, errors: { file: 'Use a PNG, JPG or WebP image.' } });
    expect(
      parseEvidenceDraft({
        ...emptyEvidence('document'),
        label: 'Big',
        file: file('application/pdf', 6 * 1024 * 1024),
      }),
    ).toMatchObject({ ok: false, errors: { file: 'Files must be 5 MB or smaller.' } });
  });

  it('references a metric instead of copying its value', () => {
    const result = parseEvidenceDraft({
      ...emptyEvidence('metric'),
      label: 'Users',
      linked_metric_id: 'm1',
    });
    expect(result).toMatchObject({
      ok: true,
      row: { linked_metric_id: 'm1', text_value: null, url: null },
    });
  });
});
