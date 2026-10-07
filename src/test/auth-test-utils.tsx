import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import type { AppRole, Profile } from '@/types/app';

export function makeProfile(role: AppRole, overrides: Partial<Profile> = {}): Profile {
  return {
    id: `${role}-user-id`,
    role,
    email: `${role}@example.com`,
    full_name: role === 'admin' ? 'Admin User' : 'Dilnoza Yusupova',
    phone: null,
    linkedin_url: null,
    notify_update_reminders: true,
    notify_weekly_summary: false,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'signed_out',
    session: null,
    user: null,
    profile: null,
    profileStatus: 'idle',
    refetchProfile: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function signedInAs(role: AppRole): AuthContextValue {
  const profile = makeProfile(role);
  const user = { id: profile.id, email: profile.email } as User;
  return makeAuth({
    status: 'signed_in',
    session: { user } as Session,
    user,
    profile,
    profileStatus: 'ready',
  });
}

export function TestProviders({ auth, children }: { auth: AuthContextValue; children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}
