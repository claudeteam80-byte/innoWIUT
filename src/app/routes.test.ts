import type { RouteObject } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from './routes';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

function collectPaths(list: RouteObject[]): string[] {
  return list.flatMap((route) => [
    ...(route.path ? [route.path] : []),
    ...(route.children ? collectPaths(route.children) : []),
  ]);
}

describe('route table', () => {
  const allPaths = collectPaths(routes);

  it('registers every V1 route', () => {
    expect(allPaths).toEqual(
      expect.arrayContaining([
        '/',
        '/auth',
        '/founder/login',
        '/founder/signup',
        '/founder/verify-email',
        '/admin/login',
        '/forgot-password',
        '/reset-password',
        '/founder/onboarding',
        '/founder/dashboard',
        '/founder/updates',
        '/founder/traction',
        '/founder/mentor',
        '/founder/startup',
        '/founder/settings',
        '/admin/dashboard',
        '/admin/startups',
        '/admin/startups/:id',
        '/admin/mentors',
        '/admin/meeting-requests',
        '/admin/settings',
        '*',
      ]),
    );
  });

  it('has no public admin sign up', () => {
    expect(allPaths.filter((path) => /^\/admin\/(signup|sign-up|register)/.test(path))).toEqual([]);
  });

  it('keeps V1-hidden screens out of the app', () => {
    expect(allPaths).not.toContain('/mentor-directory');
    expect(allPaths).not.toContain('/team-management');
    expect(allPaths).not.toContain('/founder/help');
  });
});
