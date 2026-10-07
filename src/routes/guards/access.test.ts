import { describe, expect, it } from 'vitest';
import {
  isAdminRole,
  resolveHomeRedirect,
  roleSatisfies,
  resolveOnboardingAccess,
  resolveRoleAccess,
  resolveSignedInRedirect,
  type AuthStatus,
  type ProfileStatus,
} from './access';
import type { AppRole } from '@/types/app';

const location = { pathname: '/founder/traction', search: '?tab=history' };

function session(
  authStatus: AuthStatus,
  profileStatus: ProfileStatus = 'idle',
  role: AppRole | null = null,
) {
  return { authStatus, profileStatus, role };
}

describe('resolveRoleAccess', () => {
  it('waits while the session is loading', () => {
    expect(resolveRoleAccess({ ...session('loading'), requiredRole: 'founder', location })).toEqual(
      {
        kind: 'loading',
      },
    );
  });

  it('sends signed-out founders to founder login with a return path', () => {
    expect(
      resolveRoleAccess({ ...session('signed_out'), requiredRole: 'founder', location }),
    ).toEqual({
      kind: 'redirect',
      to: '/founder/login?returnTo=%2Ffounder%2Ftraction%3Ftab%3Dhistory',
    });
  });

  it('sends signed-out visitors of admin pages to admin login', () => {
    const decision = resolveRoleAccess({
      ...session('signed_out'),
      requiredRole: 'admin',
      location: { pathname: '/admin/startups', search: '' },
    });
    expect(decision).toEqual({ kind: 'redirect', to: '/admin/login?returnTo=%2Fadmin%2Fstartups' });
  });

  it('waits for the profile before deciding', () => {
    expect(
      resolveRoleAccess({ ...session('signed_in', 'loading'), requiredRole: 'admin', location })
        .kind,
    ).toBe('loading');
    expect(
      resolveRoleAccess({ ...session('signed_in', 'idle'), requiredRole: 'admin', location }).kind,
    ).toBe('loading');
  });

  it('reports an error when the profile cannot be loaded', () => {
    expect(
      resolveRoleAccess({ ...session('signed_in', 'error'), requiredRole: 'founder', location }),
    ).toEqual({
      kind: 'error',
    });
  });

  it('keeps founders out of the admin area', () => {
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'founder'),
        requiredRole: 'admin',
        location,
      }),
    ).toEqual({ kind: 'redirect', to: '/founder/dashboard' });
  });

  it('keeps admins out of the founder area', () => {
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'admin'),
        requiredRole: 'founder',
        location,
      }),
    ).toEqual({ kind: 'redirect', to: '/admin/dashboard' });
  });

  it('allows the matching role', () => {
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'founder'),
        requiredRole: 'founder',
        location,
      }),
    ).toEqual({ kind: 'allow' });
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'admin'),
        requiredRole: 'admin',
        location,
      }),
    ).toEqual({ kind: 'allow' });
  });
});

describe('resolveOnboardingAccess', () => {
  it('sends founders who have not finished onboarding to it', () => {
    expect(
      resolveOnboardingAccess({ status: 'ready', completed: false, require: 'complete' }),
    ).toEqual({
      kind: 'redirect',
      to: '/founder/onboarding',
    });
  });

  it('keeps finished founders out of onboarding', () => {
    expect(
      resolveOnboardingAccess({ status: 'ready', completed: true, require: 'incomplete' }),
    ).toEqual({
      kind: 'redirect',
      to: '/founder/dashboard',
    });
  });

  it('allows the right state through', () => {
    expect(
      resolveOnboardingAccess({ status: 'ready', completed: true, require: 'complete' }).kind,
    ).toBe('allow');
    expect(
      resolveOnboardingAccess({ status: 'ready', completed: false, require: 'incomplete' }).kind,
    ).toBe('allow');
  });

  it('waits or errors with the status query', () => {
    expect(
      resolveOnboardingAccess({ status: 'loading', completed: false, require: 'complete' }).kind,
    ).toBe('loading');
    expect(
      resolveOnboardingAccess({ status: 'error', completed: false, require: 'complete' }).kind,
    ).toBe('error');
  });
});

describe('resolveHomeRedirect', () => {
  it('routes by session and role', () => {
    expect(resolveHomeRedirect(session('loading'))).toEqual({ kind: 'loading' });
    expect(resolveHomeRedirect(session('signed_out'))).toEqual({ kind: 'redirect', to: '/auth' });
    expect(resolveHomeRedirect(session('signed_in', 'loading'))).toEqual({ kind: 'loading' });
    expect(resolveHomeRedirect(session('signed_in', 'error'))).toEqual({ kind: 'error' });
    expect(resolveHomeRedirect(session('signed_in', 'ready', 'founder'))).toEqual({
      kind: 'redirect',
      to: '/founder/dashboard',
    });
    expect(resolveHomeRedirect(session('signed_in', 'ready', 'admin'))).toEqual({
      kind: 'redirect',
      to: '/admin/dashboard',
    });
  });
});

describe('resolveSignedInRedirect', () => {
  it('only redirects once the role is known', () => {
    expect(resolveSignedInRedirect(session('signed_out'))).toBeNull();
    expect(resolveSignedInRedirect(session('signed_in', 'loading'))).toBeNull();
    expect(resolveSignedInRedirect(session('signed_in', 'ready', 'admin'))).toBe(
      '/admin/dashboard',
    );
    expect(resolveSignedInRedirect(session('signed_in', 'ready', 'founder'))).toBe(
      '/founder/dashboard',
    );
  });
});

describe('superadmin role', () => {
  it('shares the admin area', () => {
    expect(isAdminRole('superadmin')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('founder')).toBe(false);
    expect(roleSatisfies('superadmin', 'admin')).toBe(true);
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'superadmin'),
        requiredRole: 'admin',
        location,
      }),
    ).toEqual({ kind: 'allow' });
  });

  it('is the only role allowed into superadmin areas', () => {
    expect(roleSatisfies('admin', 'superadmin')).toBe(false);
    expect(roleSatisfies('founder', 'superadmin')).toBe(false);
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'admin'),
        requiredRole: 'superadmin',
        location,
      }),
    ).toEqual({ kind: 'redirect', to: '/admin/dashboard' });
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'founder'),
        requiredRole: 'superadmin',
        location,
      }),
    ).toEqual({ kind: 'redirect', to: '/founder/dashboard' });
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'superadmin'),
        requiredRole: 'superadmin',
        location,
      }),
    ).toEqual({ kind: 'allow' });
  });

  it('is kept out of the founder area and sent home to the admin dashboard', () => {
    expect(
      resolveRoleAccess({
        ...session('signed_in', 'ready', 'superadmin'),
        requiredRole: 'founder',
        location,
      }),
    ).toEqual({ kind: 'redirect', to: '/admin/dashboard' });
    expect(resolveHomeRedirect(session('signed_in', 'ready', 'superadmin'))).toEqual({
      kind: 'redirect',
      to: '/admin/dashboard',
    });
  });
});
