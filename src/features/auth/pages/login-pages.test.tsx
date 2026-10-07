import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAuth, makeProfile, TestProviders } from '@/test/auth-test-utils';
import { ADMIN_ACCESS_DENIED_MESSAGE } from '../errors';
import { AdminLoginPage } from './AdminLoginPage';
import { FounderLoginPage } from './FounderLoginPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const api = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  fetchProfile: vi.fn(),
  signOutLocal: vi.fn(),
}));
vi.mock('../api', () => api);

function Landing() {
  const location = useLocation();
  return <h1>{`Landed on ${location.pathname}`}</h1>;
}

function renderLogin(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/admin/login', element: <AdminLoginPage /> },
      { path: '/founder/login', element: <FounderLoginPage /> },
      { path: '*', element: <Landing /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders auth={makeAuth()}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
}

async function submit(user: ReturnType<typeof userEvent.setup>, email: string, buttonName: string) {
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/^password/i), 'secret-password');
  await user.click(screen.getByRole('button', { name: buttonName }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.signOutLocal.mockResolvedValue(undefined);
});

describe('AdminLoginPage', () => {
  it('signs a founder straight back out and explains why', async () => {
    const user = userEvent.setup();
    api.signInWithPassword.mockResolvedValue({ user: { id: 'founder-user-id' } });
    api.fetchProfile.mockResolvedValue(makeProfile('founder'));

    renderLogin('/admin/login');
    await submit(user, 'founder@example.com', 'Sign In to Admin Dashboard');

    expect(await screen.findByRole('alert')).toHaveTextContent(ADMIN_ACCESS_DENIED_MESSAGE);
    expect(api.signOutLocal).toHaveBeenCalledTimes(1);
  });

  it('takes an admin to the admin dashboard', async () => {
    const user = userEvent.setup();
    api.signInWithPassword.mockResolvedValue({ user: { id: 'admin-user-id' } });
    api.fetchProfile.mockResolvedValue(makeProfile('admin'));

    renderLogin('/admin/login');
    await submit(user, 'admin@example.com', 'Sign In to Admin Dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Landed on /admin/dashboard' }),
    ).toBeInTheDocument();
    expect(api.signOutLocal).not.toHaveBeenCalled();
  });

  it('honours a safe admin returnTo but ignores one outside the admin area', async () => {
    const user = userEvent.setup();
    api.signInWithPassword.mockResolvedValue({ user: { id: 'admin-user-id' } });
    api.fetchProfile.mockResolvedValue(makeProfile('admin'));

    renderLogin('/admin/login?returnTo=%2Ffounder%2Fdashboard');
    await submit(user, 'admin@example.com', 'Sign In to Admin Dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Landed on /admin/dashboard' }),
    ).toBeInTheDocument();
  });

  it('validates input before calling Supabase', async () => {
    const user = userEvent.setup();
    renderLogin('/admin/login');
    await user.click(screen.getByRole('button', { name: 'Sign In to Admin Dashboard' }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(api.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('FounderLoginPage', () => {
  it('refuses admin accounts and points them to admin access', async () => {
    const user = userEvent.setup();
    api.signInWithPassword.mockResolvedValue({ user: { id: 'admin-user-id' } });
    api.fetchProfile.mockResolvedValue(makeProfile('admin'));

    renderLogin('/founder/login');
    await submit(user, 'admin@example.com', 'Sign In');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Use Admin access/);
    expect(api.signOutLocal).toHaveBeenCalledTimes(1);
  });

  it('returns a founder to the page they asked for', async () => {
    const user = userEvent.setup();
    api.signInWithPassword.mockResolvedValue({ user: { id: 'founder-user-id' } });
    api.fetchProfile.mockResolvedValue(makeProfile('founder'));

    renderLogin('/founder/login?returnTo=%2Ffounder%2Ftraction');
    await submit(user, 'founder@example.com', 'Sign In');

    expect(
      await screen.findByRole('heading', { name: 'Landed on /founder/traction' }),
    ).toBeInTheDocument();
  });
});
