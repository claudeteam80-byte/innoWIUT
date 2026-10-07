import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAppShell } from '@/layouts/AdminAppShell';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import type { AuthContextValue } from '@/features/auth/auth-context';
import { AdminAccessPage } from './pages/AdminAccessPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
const api = vi.hoisted(() => ({
  accessKeys: { users: ['admin', 'access', 'users'], events: ['admin', 'access', 'events'] },
  fetchAdminUsers: vi.fn(),
  fetchRoleEvents: vi.fn(),
  findUserByEmail: vi.fn(),
  grantAdminAccess: vi.fn(),
  revokeAdminAccess: vi.fn(),
  promoteToSuperadmin: vi.fn(),
}));
vi.mock('./access-api', () => api);

const owner = signedInAs('superadmin');
const admins = [
  {
    id: owner.user!.id,
    full_name: 'Owner Person',
    email: 'owner@example.com',
    role: 'superadmin',
    added_at: '2026-10-01T00:00:00Z',
    last_sign_in_at: '2026-10-07T00:00:00Z',
  },
  {
    id: 'admin-2',
    full_name: 'Aziza Admin',
    email: 'aziza@example.com',
    role: 'admin',
    added_at: '2026-10-02T00:00:00Z',
    last_sign_in_at: null,
  },
];

function renderWith(element: React.ReactNode, auth: AuthContextValue = owner) {
  const router = createMemoryRouter([{ path: '*', element }], {
    initialEntries: ['/admin/access'],
  });
  render(
    <TestProviders auth={auth}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchAdminUsers.mockResolvedValue(admins);
  api.fetchRoleEvents.mockResolvedValue([
    {
      id: 'e2',
      target_email: 'old@example.com',
      previous_role: 'admin',
      new_role: 'founder',
      created_at: '2026-10-03T00:00:00Z',
      changed_by_email: 'former-owner@example.com',
      actor: null,
    },
    {
      id: 'e1',
      target_email: 'aziza@example.com',
      previous_role: 'founder',
      new_role: 'admin',
      created_at: '2026-10-02T00:00:00Z',
      actor: { full_name: 'Owner Person', email: 'owner@example.com' },
    },
    {
      id: 'e0',
      target_email: 'owner@example.com',
      previous_role: 'founder',
      new_role: 'superadmin',
      created_at: '2026-10-01T00:00:00Z',
      actor: null,
    },
  ]);
  api.grantAdminAccess.mockResolvedValue(undefined);
  api.revokeAdminAccess.mockResolvedValue(undefined);
  api.promoteToSuperadmin.mockResolvedValue(undefined);
});

describe('Admin Access sidebar item', () => {
  const renderShell = (auth: AuthContextValue) => {
    const router = createMemoryRouter([
      { path: '*', element: <AdminAppShell />, children: [{ index: true, element: null }] },
    ]);
    render(
      <TestProviders auth={auth}>
        <RouterProvider router={router} />
      </TestProviders>,
    );
  };

  it('is shown to superadmins', () => {
    renderShell(signedInAs('superadmin'));
    expect(screen.getByRole('link', { name: 'Admin Access' })).toHaveAttribute(
      'href',
      '/admin/access',
    );
  });

  it('is hidden from regular admins', () => {
    renderShell(signedInAs('admin'));
    expect(screen.queryByRole('link', { name: 'Admin Access' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mentors' })).toBeInTheDocument();
  });
});

describe('AdminAccessPage', () => {
  it('lists admin users and the role history', async () => {
    renderWith(<AdminAccessPage />);
    const table = await screen.findByRole('table', { name: 'Admin users' });
    expect(within(table).getByText('Owner Person')).toBeInTheDocument();
    expect(within(table).getByText('(you)')).toBeInTheDocument();
    expect(within(table).getByText('Superadmin')).toBeInTheDocument();
    expect(within(table).getByText('Never signed in')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'Promote to Superadmin' })).toHaveLength(1);
    expect(await screen.findByText(/by SQL editor \(manual\)/)).toBeInTheDocument();
    expect(screen.getByText(/by Owner Person/)).toBeInTheDocument();
    expect(screen.getByText(/by former-owner@example.com/)).toBeInTheDocument();
  });

  it('grants admin access only after finding the account and confirming', async () => {
    const user = userEvent.setup();
    api.findUserByEmail.mockResolvedValue({
      id: 'u9',
      full_name: 'Bekzod T',
      email: 'bekzod@example.com',
      role: 'founder',
      owns_startup: false,
    });
    renderWith(<AdminAccessPage />);
    await user.click(await screen.findByRole('button', { name: /Grant Admin Access/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Grant admin access' });
    await user.type(within(dialog).getByLabelText('Email'), 'Bekzod@Example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Find account' }));
    expect(await within(dialog).findByText('Bekzod T')).toBeInTheDocument();
    expect(api.findUserByEmail.mock.calls[0]![0]).toBe('bekzod@example.com');
    const grant = within(dialog).getByRole('button', { name: 'Grant Admin Access' });
    expect(grant).toBeDisabled();
    await user.click(within(dialog).getByLabelText(/I confirm that Bekzod T/));
    await user.click(grant);
    await vi.waitFor(() => expect(api.grantAdminAccess).toHaveBeenCalledWith('bekzod@example.com'));
  });

  it('explains that a missing user needs an account first', async () => {
    const user = userEvent.setup();
    api.findUserByEmail.mockResolvedValue(null);
    renderWith(<AdminAccessPage />);
    await user.click(await screen.findByRole('button', { name: /Grant Admin Access/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Grant admin access' });
    await user.type(within(dialog).getByLabelText('Email'), 'new@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Find account' }));
    expect(
      await within(dialog).findByText(
        'This user needs an account before admin access can be granted.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Grant Admin Access' }),
    ).not.toBeInTheDocument();
  });

  it('refuses founders who own a startup', async () => {
    const user = userEvent.setup();
    api.findUserByEmail.mockResolvedValue({
      id: 'u8',
      full_name: 'Founder F',
      email: 'f@example.com',
      role: 'founder',
      owns_startup: true,
    });
    renderWith(<AdminAccessPage />);
    await user.click(await screen.findByRole('button', { name: /Grant Admin Access/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Grant admin access' });
    await user.type(within(dialog).getByLabelText('Email'), 'f@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Find account' }));
    expect(await within(dialog).findByText(/owns a startup/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Grant Admin Access' }),
    ).not.toBeInTheDocument();
  });

  it('promotes only after typing the admin email', async () => {
    const user = userEvent.setup();
    renderWith(<AdminAccessPage />);
    await user.click(await screen.findByRole('button', { name: 'Promote to Superadmin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Promote to superadmin?' });
    const confirm = within(dialog).getByRole('button', { name: 'Promote to Superadmin' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Type aziza@example.com/), 'aziza@example.com');
    await user.click(confirm);
    await vi.waitFor(() =>
      expect(api.promoteToSuperadmin).toHaveBeenCalledWith('admin-2', 'aziza@example.com'),
    );
  });

  it('revokes another admin after confirmation', async () => {
    const user = userEvent.setup();
    renderWith(<AdminAccessPage />);
    const table = await screen.findByRole('table', { name: 'Admin users' });
    const row = within(table).getByText('Aziza Admin').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Revoke Access' }));
    const dialog = await screen.findByRole('dialog', { name: /Revoke access for Aziza Admin/ });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke Access' }));
    await vi.waitFor(() => expect(api.revokeAdminAccess).toHaveBeenCalledWith('admin-2', false));
  });

  it('requires a typed phrase before removing your own access', async () => {
    const user = userEvent.setup();
    renderWith(<AdminAccessPage />);
    const table = await screen.findByRole('table', { name: 'Admin users' });
    const row = within(table).getByText('Owner Person').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Revoke Access' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove your own admin access?' });
    const confirm = within(dialog).getByRole('button', { name: 'Remove my access' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Type REMOVE MY ACCESS/), 'REMOVE MY ACCESS');
    await user.click(confirm);
    await vi.waitFor(() =>
      expect(api.revokeAdminAccess).toHaveBeenCalledWith(owner.user!.id, true),
    );
  });
});
