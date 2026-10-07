import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AuthStatus, ProfileStatus } from '@/routes/guards/access';
import { AuthContext, type AuthContextValue } from './auth-context';
import { fetchProfile, signOutLocal } from './api';
import { authKeys } from './query-keys';

interface SessionState {
  status: AuthStatus;
  session: Session | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    // Fires INITIAL_SESSION immediately, then on every sign in / out / refresh.
    // Keep this callback synchronous: Supabase holds a lock while it runs.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ status: session ? 'signed_in' : 'signed_out', session });
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = state.session?.user.id;
  const profileQuery = useQuery({
    queryKey: authKeys.profile(userId),
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
    // Re-check the role regularly so revoked admin access leaves the UI quickly.
    // The database refuses revoked users immediately either way.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  let profileStatus: ProfileStatus = 'idle';
  if (userId) {
    if (profileQuery.isPending) profileStatus = 'loading';
    else if (profileQuery.isError || !profileQuery.data) profileStatus = 'error';
    else profileStatus = 'ready';
  }

  const { refetch } = profileQuery;
  const refetchProfile = useCallback(() => {
    void refetch();
  }, [refetch]);

  const signOut = useCallback(async () => {
    await signOutLocal();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      session: state.session,
      user: state.session?.user ?? null,
      profile: profileStatus === 'ready' ? (profileQuery.data ?? null) : null,
      profileStatus,
      refetchProfile,
      signOut,
    }),
    [state, profileStatus, profileQuery.data, refetchProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
