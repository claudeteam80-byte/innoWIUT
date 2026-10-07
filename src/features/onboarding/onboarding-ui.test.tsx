import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import { OnboardingPage } from './pages/OnboardingPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
const complete = vi.hoisted(() => ({ completeOnboarding: vi.fn(), setStartupLogo: vi.fn() }));
vi.mock('./complete', () => complete);

function renderOnboarding() {
  const router = createMemoryRouter(
    [
      { path: '/founder/onboarding', element: <OnboardingPage /> },
      { path: '/founder/dashboard', element: <h1>Founder dashboard</h1> },
    ],
    { initialEntries: ['/founder/onboarding'] },
  );
  render(
    <TestProviders auth={signedInAs('founder')}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  complete.completeOnboarding.mockResolvedValue('startup-1');
});

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Phone number/), '+998 90 123 45 67');
  await user.selectOptions(screen.getByLabelText(/Role in startup/), 'CEO');
  await user.click(screen.getByRole('button', { name: /Continue/ }));
}

async function fillStepTwo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Startup name/), 'Gamma Labs');
  await user.type(screen.getByLabelText(/One-line description/), 'Adaptive IELTS practice');
  await user.selectOptions(screen.getByLabelText(/Industry/), 'EdTech');
  await user.selectOptions(screen.getByLabelText(/Startup stage/), 'MVP');
  await user.type(screen.getByLabelText(/Founded year/), '2025');
  await user.type(screen.getByLabelText(/Team size/), '4');
  await user.click(screen.getByRole('button', { name: /Continue/ }));
}

describe('OnboardingPage', () => {
  it('validates each step before moving on', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Dilnoza Yusupova');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByText('Enter your phone number.')).toBeInTheDocument();
    expect(screen.getByText('Choose your role.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
  });

  it('shows conditional progress fields only when answered yes', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await fillStepOne(user);
    await fillStepTwo(user);
    expect(await screen.findByRole('heading', { name: 'Current progress' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Current number of users/)).not.toBeInTheDocument();
    await user.click(
      screen
        .getByRole('group', { name: /currently have users/ })
        .querySelector('input[value="yes"]')!,
    );
    expect(screen.getByLabelText(/Current number of users/)).toBeInTheDocument();
    await user.click(
      screen
        .getByRole('group', { name: /currently have users/ })
        .querySelector('input[value="no"]')!,
    );
    expect(screen.queryByLabelText(/Current number of users/)).not.toBeInTheDocument();
  });

  it('completes onboarding in one call and lands on the dashboard', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await fillStepOne(user);
    await fillStepTwo(user);
    const pick = (group: RegExp, value: 'yes' | 'no') =>
      user.click(
        screen.getByRole('group', { name: group }).querySelector(`input[value="${value}"]`)!,
      );
    await pick(/working product/, 'yes');
    await pick(/currently have users/, 'yes');
    await user.type(screen.getByLabelText(/Current number of users/), '320');
    await pick(/have revenue/, 'yes');
    await user.click(screen.getByRole('button', { name: 'Complete setup' }));
    expect(await screen.findByText('Enter your current monthly revenue.')).toBeInTheDocument();
    expect(screen.getByText('Choose a currency.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Current monthly revenue/), '1500000');
    await user.selectOptions(screen.getByLabelText(/^Currency/), 'UZS');
    await user.type(screen.getByLabelText(/Current main goal/), 'Reach 1,000 learners');
    await user.type(screen.getByLabelText(/Biggest current challenge/), 'Content production');
    await user.click(screen.getByRole('button', { name: 'Complete setup' }));

    expect(await screen.findByRole('heading', { name: 'Founder dashboard' })).toBeInTheDocument();
    expect(complete.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(complete.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Dilnoza Yusupova',
        role_in_startup: 'CEO',
        name: 'Gamma Labs',
        founded_year: 2025,
        team_size: 4,
        has_users: true,
        current_users: 320,
        has_revenue: true,
        monthly_revenue: 1500000,
        revenue_currency: 'UZS',
      }),
    );
    expect(complete.setStartupLogo).not.toHaveBeenCalled();
  });

  it('shows a server error and stays on the form', async () => {
    const user = userEvent.setup();
    complete.completeOnboarding.mockRejectedValue({
      code: '22023',
      message: 'Answer every progress question.',
    });
    renderOnboarding();
    await fillStepOne(user);
    await fillStepTwo(user);
    const pick = (group: RegExp) =>
      user.click(screen.getByRole('group', { name: group }).querySelector('input[value="no"]')!);
    await pick(/working product/);
    await pick(/currently have users/);
    await pick(/have revenue/);
    await user.type(screen.getByLabelText(/Current main goal/), 'Goal');
    await user.type(screen.getByLabelText(/Biggest current challenge/), 'Challenge');
    await user.click(screen.getByRole('button', { name: 'Complete setup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Answer every progress question.');
    expect(screen.queryByRole('heading', { name: 'Founder dashboard' })).not.toBeInTheDocument();
  });
});
