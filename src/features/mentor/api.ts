import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { MeetingRequestInput } from './schemas';

export type Mentor = Tables<'mentors'>;
export type MentorNote = Tables<'mentor_notes'>;
export type MeetingRequest = Tables<'meeting_requests'>;

export async function fetchAssignedMentor(startupId: string): Promise<Mentor | null> {
  const { data, error } = await supabase
    .from('mentor_assignments')
    .select('mentor:mentors(*)')
    .eq('startup_id', startupId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data?.mentor as Mentor | null | undefined) ?? null;
}

export async function fetchMentorNotes(startupId: string): Promise<MentorNote[]> {
  const { data, error } = await supabase
    .from('mentor_notes')
    .select('*')
    .eq('startup_id', startupId)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchMeetingRequests(startupId: string): Promise<MeetingRequest[]> {
  const { data, error } = await supabase
    .from('meeting_requests')
    .select('*')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMeetingRequest(
  startupId: string,
  mentorId: string,
  values: { reason: string; message: string | null; preferred_date: string | null },
): Promise<void> {
  const { error } = await supabase.from('meeting_requests').insert({
    startup_id: startupId,
    mentor_id: mentorId,
    reason: values.reason,
    message: values.message,
    preferred_date: values.preferred_date,
  });
  if (error) throw error;
}

export type { MeetingRequestInput };
