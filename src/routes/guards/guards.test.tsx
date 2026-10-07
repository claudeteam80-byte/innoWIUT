import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, useLocation, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FounderOnboardingState } from '@/features/onboarding/useFounderOnboarding';
import { makeAuth, signedInAs, TestProviders } from '@/test/auth-test-utils';
import type { AuthContextValue } from '@/features/auth/auth-context';
import { RequireOnboarding } from './RequireOnboarding';
import { RequireRole } from './RequireRole';
import { RootRedirect } from './RootRedirect';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const onboarding = vi.hoisted(() => ({
  state: { status: 'ready', completed: true, startupId: 'startup-1' } as FounderOnboardingState,
}));
vi.mock('@/features/onboarding/useFounderOnboarding', () => ({
  useFounderOnboarding: () => onboarding.state,
}));

function Screen({ name }: { name: string }) {
  const location = useLocation();
  return (
    <div>
      <h1>{name}</h1>
      <p data-testid="location">{`${location.pathname}${location.search}`}</p>
    </div>
  );
}

const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  { path: '/auth', element: <Screen name="Auth choice" /> },
  { path: '/founder/login', element: <Screen name="Founder login" /> },
  { path: '/admin/login', element: <Screen name="Admin login" /> },
  {
    element: <RequireRole role="founder" />,
    children: [
      {
        element: <RequireOnboarding require="incomplete" />,
        children: [{ path: '/founder/onboarding', element: <Screen name="Onboarding" /> }],
      },
      {
        element: <RequireOnboarding require="complete" />,
        children: [
          {
            element: <Outlet />,
            children: [
              { path: '/founder/dashboard', element: <Screen name="Founder dashboard" /> },
              { path: '/founder/traction', element: <Screen name="Founder traction" /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <RequireRole role="admin" />,
    children: [
      { path: '/admin/dashboard', element: <Screen name="Admin dashboard" /> },
      { path: '/admin/startups', element: <Screen name="Admin startups" /> },
    ],
  },
];

function renderAt(path: string, auth: AuthContextValue) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <TestProviders auth={auth}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
}

beforeEach(() => {
  onboarding.state = { status: 'ready', completed: true, startupId: 'startup-1' };
});

describe('RequireRole', () => {
  it('shows a loading state while the session is restored', () => {
    renderAt('/founder/dashboard', makeAuth({ status: 'loading' }));
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('redirects signed-out founders to founder login and remembers the page', async () => {
    renderAt('/founder/traction', makeAuth());
    expect(await screen.findByRole('heading', { name: 'Founder login' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/founder/login?returnTo=%2Ffounder%2Ftraction',
    );
  });

  it('redirects signed-out visitors of admin pages to admin login', async () => {
    renderAt('/admin/startups', makeAuth());
    expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/login?returnTo=%2Fadmin%2Fstartups',
    );
  });

  it('keeps a founder out of the admin area', async () => {
    renderAt('/admin/dashboard', signedInAs('founder'));
    expect(await screen.findByRole('heading', { name: 'Founder dashboard' })).toBeInTheDocument();
  });

  it('keeps an admin out of the founder area', async () => {
    renderAt('/founder/dashboard', signedInAs('admin'));
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
  });

  it('lets an admin into the admin area', async () => {
    renderAt('/admin/startups', signedInAs('admin'));
    expect(await screen.findByRole('heading', { name: 'Admin startups' })).toBeInTheDocument();
  });

  it('shows an account error when the profile cannot be loaded', async () => {
    renderAt('/founder/dashboard', makeAuth({ status: 'signed_in', profileStatus: 'error' }));
    expect(
      await screen.findByRole('heading', { name: "We couldn't load your account" }),
    ).toBeInTheDocument();
  });
});

describe('RequireOnboarding', () => {
  it('sends founders who have not finished onboarding to onboarding', async () => {
    onboarding.state = { status: 'ready', completed: false, startupId: null };
    renderAt('/founder/dashboard', signedInAs('founder'));
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  });

  it('lets founders who have not finished onboarding see it', async () => {
    onboarding.state = { status: 'ready', completed: false, startupId: null };
    renderAt('/founder/onboarding', signedInAs('founder'));
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  });

  it('sends onboarded founders from onboarding to their dashboard', async () => {
    renderAt('/founder/onboarding', signedInAs('founder'));
    expect(await screen.findByRole('heading', { name: 'Founder dashboard' })).toBeInTheDocument();
  });

  it('lets onboarded founders into the workspace', async () => {
    renderAt('/founder/traction', signedInAs('founder'));
    expect(await screen.findByRole('heading', { name: 'Founder traction' })).toBeInTheDocument();
  });

  it('waits for the onboarding status', () => {
    onboarding.state = { status: 'loading', completed: false, startupId: null };
    renderAt('/founder/dashboard', signedInAs('founder'));
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('shows an error when the onboarding status cannot be loaded', async () => {
    onboarding.state = { status: 'error', completed: false, startupId: null };
    renderAt('/founder/dashboard', signedInAs('founder'));
    expect(
      await screen.findByRole('heading', { name: "We couldn't load your account" }),
    ).toBeInTheDocument();
  });
});

describe('RootRedirect', () => {
  it('sends visitors to the access choice', async () => {
    renderAt('/', makeAuth());
    expect(await screen.findByRole('heading', { name: 'Auth choice' })).toBeInTheDocument();
  });

  it('sends signed-in users to their home', async () => {
    renderAt('/', signedInAs('admin'));
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
  });
});
