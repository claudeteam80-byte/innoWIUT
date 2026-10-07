import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Functions = Database['public']['Functions'];
export type AdminUser = Functions['admin_access_list']['Returns'][number];
export type FoundUser = Functions['admin_find_user']['Returns'][number];

export const accessKeys = {
  users: ['admin', 'access', 'users'] as const,
  events: ['admin', 'access', 'events'] as const,
};

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_access_list');
  if (error) throw error;
  return data;
}

export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const { data, error } = await supabase.rpc('admin_find_user', { p_email: email });
  if (error) throw error;
  return data[0] ?? null;
}

export async function grantAdminAccess(email: string): Promise<void> {
  const { error } = await supabase.rpc('grant_admin_access', { p_email: email });
  if (error) throw error;
}

export async function revokeAdminAccess(userId: string, confirmSelf = false): Promise<void> {
  const { error } = await supabase.rpc('revoke_admin_access', {
    p_user_id: userId,
    p_confirm_self: confirmSelf,
  });
  if (error) throw error;
}

export async function promoteToSuperadmin(userId: string, confirmEmail: string): Promise<void> {
  const { error } = await supabase.rpc('promote_to_superadmin', {
    p_user_id: userId,
    p_confirm_email: confirmEmail,
  });
  if (error) throw error;
}

export async function fetchRoleEvents(limit = 50) {
  const { data, error } = await supabase
    .from('admin_role_events')
    .select(
      'id, target_email, previous_role, new_role, created_at, changed_by_email, actor:profiles!admin_role_events_changed_by_fkey(full_name, email)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
export type RoleEvent = Awaited<ReturnType<typeof fetchRoleEvents>>[number];
