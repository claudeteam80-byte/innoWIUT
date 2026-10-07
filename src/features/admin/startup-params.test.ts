import { describe, expect, it, vi } from 'vitest';
import { startupListArgs, STARTUP_PAGE_SIZE } from './api';
import { paramsFromSearch, searchFromParams } from './startup-params';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('startup list URL state', () => {
  it('reads defaults from an empty URL', () => {
    expect(paramsFromSearch(new URLSearchParams())).toEqual({
      search: '',
      stage: '',
      industry: '',
      activity: '',
      mentor: '',
      sort: 'recent',
      page: 1,
    });
  });

  it('round-trips search, filters, sort and page', () => {
    const params = {
      search: 'gamma',
      stage: 'MVP',
      industry: 'EdTech',
      activity: 'needs_update',
      mentor: 'unassigned',
      sort: 'growth' as const,
      page: 3,
    };
    expect(paramsFromSearch(searchFromParams(params))).toEqual(params);
    expect(searchFromParams(params).toString()).toBe(
      'q=gamma&stage=MVP&industry=EdTech&activity=needs_update&mentor=unassigned&sort=growth&page=3',
    );
  });

  it('ignores unknown sorts and bad pages', () => {
    const params = paramsFromSearch(new URLSearchParams('sort=random&page=-4'));
    expect(params.sort).toBe('recent');
    expect(params.page).toBe(1);
  });
});

describe('startupListArgs', () => {
  it('sends only active filters and the page window to the database', () => {
    expect(
      startupListArgs({
        search: '  gam ',
        stage: '',
        industry: 'EdTech',
        activity: '',
        mentor: 'assigned',
        sort: 'oldest',
        page: 2,
      }),
    ).toEqual({
      p_search: 'gam',
      p_stage: undefined,
      p_industry: 'EdTech',
      p_activity: undefined,
      p_mentor: 'assigned',
      p_sort: 'oldest',
      p_limit: STARTUP_PAGE_SIZE,
      p_offset: STARTUP_PAGE_SIZE,
    });
  });
});
