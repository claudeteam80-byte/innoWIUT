import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthStatus, ProfileStatus } from '@/routes/guards/access';
import type { Profile } from '@/types/app';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  refetchProfile: () => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
