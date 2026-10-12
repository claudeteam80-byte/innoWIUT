import type { ReviewQueueParams, ReviewTab } from './api';

export const REVIEW_TABS: { value: ReviewTab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'needs_work', label: 'Needs Work' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
];

const TABS = new Set<string>(REVIEW_TABS.map((t) => t.value));
const STAGES = new Set(['idea', 'validation', 'mvp']);

/** Queue state lives in the URL. Default: pending, oldest first. */
export function queueParamsFromSearch(search: URLSearchParams): ReviewQueueParams {
  const tab = search.get('tab') ?? 'pending';
  const stage = search.get('stage') ?? '';
  const page = Number.parseInt(search.get('page') ?? '1', 10);
  return {
    tab: (TABS.has(tab) ? tab : 'pending') as ReviewTab,
    stage: STAGES.has(stage) ? stage : '',
    search: search.get('q') ?? '',
    sort: search.get('sort') === 'newest' ? 'newest' : 'oldest',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function searchFromQueueParams(params: ReviewQueueParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.tab !== 'pending') search.set('tab', params.tab);
  if (params.stage) search.set('stage', params.stage);
  if (params.search.trim()) search.set('q', params.search.trim());
  if (params.sort !== 'oldest') search.set('sort', params.sort);
  if (params.page > 1) search.set('page', String(params.page));
  return search;
}
