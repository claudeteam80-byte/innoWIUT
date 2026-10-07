import type { StartupListParams, StartupSort } from './api';

export const STARTUP_SORTS: { value: StartupSort; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'growth', label: 'Highest Growth' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

const SORTS = new Set<string>(STARTUP_SORTS.map((s) => s.value));

/** Reads list state from the URL so filters survive reloads and back navigation. */
export function paramsFromSearch(search: URLSearchParams): StartupListParams {
  const sort = search.get('sort') ?? 'recent';
  const page = Number.parseInt(search.get('page') ?? '1', 10);
  return {
    search: search.get('q') ?? '',
    stage: search.get('stage') ?? '',
    industry: search.get('industry') ?? '',
    activity: search.get('activity') ?? '',
    mentor: search.get('mentor') ?? '',
    sort: (SORTS.has(sort) ? sort : 'recent') as StartupSort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Writes list state back; defaults are omitted to keep URLs short. */
export function searchFromParams(params: StartupListParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.search.trim()) search.set('q', params.search.trim());
  if (params.stage) search.set('stage', params.stage);
  if (params.industry) search.set('industry', params.industry);
  if (params.activity) search.set('activity', params.activity);
  if (params.mentor) search.set('mentor', params.mentor);
  if (params.sort !== 'recent') search.set('sort', params.sort);
  if (params.page > 1) search.set('page', String(params.page));
  return search;
}
