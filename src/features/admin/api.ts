import { supabase } from '@/lib/supabase';
import type { Database, Enums, Tables } from '@/types/database';

type Functions = Database['public']['Functions'];
export type DashboardStats = Functions['admin_dashboard_stats']['Returns'][number];
export type StartupListRow = Functions['admin_startup_list']['Returns'][number];
export type MeetingStatus = Enums<'meeting_request_status'>;
export type Mentor = Tables<'mentors'>;

export type StartupSort = 'recent' | 'growth' | 'newest' | 'oldest';
export interface StartupListParams {
  search: string;
  stage: string;
  industry: string;
  activity: string;
  mentor: string;
  sort: StartupSort;
  page: number;
}

export const STARTUP_PAGE_SIZE = 25;

/** Maps UI filter state to admin_startup_list() arguments ('' means "any"). */
export function startupListArgs(params: StartupListParams) {
  return {
    p_search: params.search.trim() || undefined,
    p_stage: params.stage || undefined,
    p_industry: params.industry || undefined,
    p_activity: params.activity || undefined,
    p_mentor: params.mentor || undefined,
    p_sort: params.sort,
    p_limit: STARTUP_PAGE_SIZE,
    p_offset: Math.max(0, params.page - 1) * STARTUP_PAGE_SIZE,
  };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('No stats returned.');
  return row;
}

export async function fetchStartupList(
  params: StartupListParams,
): Promise<{ rows: StartupListRow[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_startup_list', startupListArgs(params));
  if (error) throw error;
  return { rows: data, total: Number(data[0]?.total_count ?? 0) };
}

export async function fetchRecentUpdates(limit = 8) {
  const { data, error } = await supabase
    .from('startup_updates')
    .select(
      'id, title, summary, update_date, published_at, startup:startups(id, name, logo_path, owner:profiles(full_name))',
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
export type RecentUpdate = Awaited<ReturnType<typeof fetchRecentUpdates>>[number];

export async function fetchStartup(id: string) {
  const { data, error } = await supabase
    .from('startups')
    .select('*, owner:profiles(id, full_name, email, phone, linkedin_url, created_at)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export type AdminStartup = NonNullable<Awaited<ReturnType<typeof fetchStartup>>>;

export async function fetchStartupActivity(id: string) {
  const { data, error } = await supabase
    .from('startup_activity')
    .select('*')
    .eq('startup_id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Published updates only — admins never see drafts (RLS enforces it too). */
export async function fetchPublishedUpdates(startupId: string) {
  const { data, error } = await supabase
    .from('startup_updates')
    .select('*')
    .eq('startup_id', startupId)
    .eq('status', 'published')
    .order('update_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchAssignments(startupId: string) {
  const { data, error } = await supabase
    .from('mentor_assignments')
    .select('id, assigned_at, ended_at, mentor:mentors(*)')
    .eq('startup_id', startupId)
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data;
}
export type AssignmentWithMentor = Awaited<ReturnType<typeof fetchAssignments>>[number];

export async function fetchAdminNotes(startupId: string) {
  const { data, error } = await supabase
    .from('mentor_notes')
    .select(
      'id, body, note_date, created_at, mentor:mentors(id, name), author:profiles(full_name, email)',
    )
    .eq('startup_id', startupId)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export type AdminNote = Awaited<ReturnType<typeof fetchAdminNotes>>[number];

export async function addMentorNote(input: {
  startupId: string;
  mentorId: string | null;
  body: string;
  noteDate: string;
}) {
  const { error } = await supabase.from('mentor_notes').insert({
    startup_id: input.startupId,
    mentor_id: input.mentorId,
    body: input.body,
    note_date: input.noteDate,
  });
  if (error) throw error;
}

export async function assignMentor(startupId: string, mentorId: string) {
  const { error } = await supabase.rpc('assign_mentor', {
    p_startup_id: startupId,
    p_mentor_id: mentorId,
  });
  if (error) throw error;
}

export async function endAssignment(startupId: string) {
  const { error } = await supabase.rpc('end_mentor_assignment', { p_startup_id: startupId });
  if (error) throw error;
}

export async function fetchMentors() {
  const { data, error } = await supabase
    .from('mentors')
    .select('*, assignments:mentor_assignments(id, ended_at, startup:startups(id, name))')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map((mentor) => ({
    ...mentor,
    activeStartups: mentor.assignments
      .filter((a) => a.ended_at === null && a.startup)
      .map((a) => a.startup as { id: string; name: string }),
  }));
}
export type MentorWithAssignments = Awaited<ReturnType<typeof fetchMentors>>[number];

export interface MentorValues {
  name: string;
  title: string | null;
  email: string | null;
  telegram: string | null;
  linkedin_url: string | null;
  expertise: string[];
  bio: string | null;
  is_active: boolean;
}

export async function createMentor(values: MentorValues): Promise<Mentor> {
  const { data, error } = await supabase.from('mentors').insert(values).select().single();
  if (error) throw error;
  return data;
}

export async function updateMentor(
  id: string,
  values: Partial<MentorValues> & { photo_path?: string | null },
) {
  const { error } = await supabase.from('mentors').update(values).eq('id', id);
  if (error) throw error;
}

/** Deletes an unused mentor, or archives one that has history. */
export async function deleteMentor(id: string): Promise<'deleted' | 'archived'> {
  const { data, error } = await supabase.rpc('delete_mentor', { p_mentor_id: id });
  if (error) throw error;
  return data as 'deleted' | 'archived';
}

export const MEETINGS_PAGE_SIZE = 25;

export async function fetchMeetingRequests(status: MeetingStatus | 'all', page: number) {
  let query = supabase
    .from('meeting_requests')
    .select(
      '*, startup:startups(id, name, owner:profiles(full_name, email)), mentor:mentors(id, name)',
      {
        count: 'exact',
      },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * MEETINGS_PAGE_SIZE, page * MEETINGS_PAGE_SIZE - 1);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}
export type AdminMeetingRequest = Awaited<ReturnType<typeof fetchMeetingRequests>>['rows'][number];

export async function updateMeetingRequest(
  id: string,
  values: { status: MeetingStatus; admin_response: string | null },
) {
  const { error } = await supabase.from('meeting_requests').update(values).eq('id', id);
  if (error) throw error;
}
