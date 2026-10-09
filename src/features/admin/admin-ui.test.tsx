import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import { MentorDialog } from './components/MentorDialog';
import { JourneyTab } from './components/JourneyTab';
import { MentorTab, UpdatesTab } from './components/StartupTabs';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminMeetingRequestsPage } from './pages/AdminMeetingRequestsPage';
import { AdminStartupsPage } from './pages/AdminStartupsPage';

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } },
}));

const api = vi.hoisted(() => ({
  STARTUP_PAGE_SIZE: 25,
  MEETINGS_PAGE_SIZE: 25,
  startupListArgs: vi.fn(),
  fetchDashboardStats: vi.fn(),
  fetchStageDistribution: vi.fn(),
  fetchRecentUpdates: vi.fn(),
  fetchStartupList: vi.fn(),
  fetchStartup: vi.fn(),
  fetchStartupActivity: vi.fn(),
  fetchPublishedUpdates: vi.fn(),
  fetchAssignments: vi.fn(),
  fetchAdminNotes: vi.fn(),
  addMentorNote: vi.fn(),
  assignMentor: vi.fn(),
  endAssignment: vi.fn(),
  fetchMentors: vi.fn(),
  createMentor: vi.fn(),
  updateMentor: vi.fn(),
  deleteMentor: vi.fn(),
  fetchMeetingRequests: vi.fn(),
  updateMeetingRequest: vi.fn(),
}));
vi.mock('./api', () => api);
const journeyApi = vi.hoisted(() => ({
  fetchRequirements: vi.fn(),
  fetchEvidence: vi.fn(),
  updateRequirement: vi.fn(),
  saveTractionChoices: vi.fn(),
  addEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
}));
vi.mock('@/features/journey/api', () => journeyApi);
const tractionApi = vi.hoisted(() => ({ fetchMetrics: vi.fn(), fetchEntries: vi.fn() }));
vi.mock('@/features/traction/api', () => tractionApi);
vi.mock('@/features/updates/hooks', () => ({
  useUpdateContext: () => undefined,
  useSignedImageUrl: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(element: React.ReactNode, path = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            {element}
            <LocationProbe />
          </>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders auth={signedInAs('admin')}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
}

const mentor = (overrides: Record<string, unknown> = {}) => ({
  id: 'mentor-1',
  name: 'Aziz Karimov',
  title: null,
  bio: null,
  expertise: ['Growth'],
  email: 'aziz@wiut.uz',
  telegram: null,
  linkedin_url: null,
  contact_url: null,
  photo_path: null,
  is_active: true,
  created_by: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  assignments: [],
  activeStartups: [],
  ...overrides,
});

const listRow = {
  id: 'startup-1',
  name: 'Gamma Labs',
  tagline: 'Adaptive learning',
  logo_path: null,
  industry: 'EdTech',
  stage: 'MVP',
  journey_stage: 'mvp',
  created_at: '2026-10-01T00:00:00Z',
  founder_name: 'Dilnoza Yusupova',
  founder_email: 'd@example.com',
  primary_metric_name: 'Monthly Revenue',
  primary_metric_unit: 'currency',
  primary_metric_currency: 'UZS',
  primary_metric_value: 1240000,
  primary_metric_previous: 1000000,
  growth_percent: 24,
  last_active_on: '2026-10-01',
  days_since_activity: 6,
  activity_status: 'needs_update',
  mentor_id: null,
  mentor_name: null,
  total_count: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchRecentUpdates.mockResolvedValue([]);
  api.fetchStageDistribution.mockResolvedValue([
    { stage: 'idea', startups: 3 },
    { stage: 'validation', startups: 1 },
    { stage: 'mvp', startups: 4 },
    { stage: 'traction', startups: 2 },
    { stage: 'investor_readiness', startups: 0 },
    { stage: 'investor_access', startups: 0 },
  ]);
  tractionApi.fetchMetrics.mockResolvedValue([]);
  tractionApi.fetchEntries.mockResolvedValue([]);
  journeyApi.fetchEvidence.mockResolvedValue([]);
  api.fetchMentors.mockResolvedValue([mentor(), mentor({ id: 'mentor-2', name: 'Bobur Aliev' })]);
});

describe('AdminDashboardPage', () => {
  it('renders the server-computed stats', async () => {
    api.fetchDashboardStats.mockResolvedValue({
      total_startups: 12,
      active_startups: 7,
      needs_update_startups: 2,
      inactive_startups: 3,
      updates_this_week: 5,
      growing_startups: 4,
      unassigned_startups: 1,
      open_meeting_requests: 0,
    });
    renderAt(<AdminDashboardPage />);
    expect(screen.getByRole('heading', { name: 'innoWIUT Startup Dashboard' })).toBeInTheDocument();
    const stats = screen.getByRole('region', { name: 'Ecosystem stats' });
    const card = (label: string) =>
      within(stats).getByRole('heading', { name: label }).closest('article')!;
    expect(await within(card('Active Startups')).findByText('7')).toBeInTheDocument();
    expect(within(card('Active Startups')).getByText(/12 onboarded in total/)).toBeInTheDocument();
    expect(within(card('Updates This Week')).getByText('5')).toBeInTheDocument();
    expect(within(card('Startups with Traction Growth')).getByText('4')).toBeInTheDocument();
    expect(within(card('Inactive Startups')).getByText('3')).toBeInTheDocument();
    expect(within(card('Inactive Startups')).getByText(/2 need an update/)).toBeInTheDocument();
    expect(await screen.findByText('No recent founder updates')).toBeInTheDocument();
  });

  it('shows recent founder updates and opens the startup', async () => {
    const user = userEvent.setup();
    api.fetchDashboardStats.mockResolvedValue({
      total_startups: 1,
      active_startups: 1,
      needs_update_startups: 0,
      inactive_startups: 0,
      updates_this_week: 1,
      growing_startups: 0,
      unassigned_startups: 1,
      open_meeting_requests: 0,
    });
    api.fetchRecentUpdates.mockResolvedValue([
      {
        id: 'u1',
        title: 'Shipped V2',
        summary: 'Reading practice is live.',
        update_date: '2026-10-05',
        published_at: '2026-10-05T10:00:00Z',
        startup: {
          id: 'startup-1',
          name: 'Gamma Labs',
          logo_path: null,
          owner: { full_name: 'Dilnoza Yusupova' },
        },
      },
    ]);
    renderAt(<AdminDashboardPage />);
    await user.click(await screen.findByRole('button', { name: /Shipped V2/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/startups/startup-1?tab=updates',
    );
    expect(screen.getByText(/Gamma Labs · Dilnoza Yusupova/)).toBeInTheDocument();
  });

  it('offers a retry when stats fail', async () => {
    api.fetchDashboardStats.mockRejectedValue(new Error('boom'));
    renderAt(<AdminDashboardPage />);
    expect(await screen.findByText("We couldn't load the ecosystem stats.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Stage Distribution', () => {
  it('shows onboarded startups per open stage from the database', async () => {
    api.fetchDashboardStats.mockResolvedValue({
      total_startups: 10,
      active_startups: 0,
      needs_update_startups: 0,
      inactive_startups: 0,
      updates_this_week: 0,
      growing_startups: 0,
      unassigned_startups: 0,
      open_meeting_requests: 0,
    });
    renderAt(<AdminDashboardPage />);
    const list = await screen.findByRole('list', { name: 'Startups per stage' });
    expect(within(list).getByRole('link', { name: 'Idea: 3 startups' })).toHaveAttribute(
      'href',
      '/admin/startups?stage=idea',
    );
    expect(within(list).getByRole('link', { name: 'Validation: 1 startup' })).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'MVP: 4 startups' })).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Traction: 2 startups' })).toBeInTheDocument();
    expect(within(list).getAllByRole('link')).toHaveLength(4);
    expect(within(list).getByRole('link', { name: 'MVP: 4 startups' })).toHaveTextContent(
      '4 · 40%',
    );
    expect(api.fetchStageDistribution).toHaveBeenCalledTimes(1);
  });
});

describe('JourneyTab (admin, read-only)', () => {
  const requirement = (key: string, title: string, overrides: Record<string, unknown> = {}) => ({
    id: `r-${key}`,
    startup_id: 's',
    stage: 'validation',
    requirement_key: key,
    title,
    description: null,
    required: true,
    status: 'not_started',
    progress_value: null,
    progress_target: null,
    linked_metric_id: null,
    completed_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  });

  it('shows stage, progress, requirement status, evidence and stage-linked updates', async () => {
    journeyApi.fetchRequirements.mockResolvedValue([
      requirement('customer_interviews', 'Customer Interviews', {
        status: 'in_progress',
        progress_value: 6,
        progress_target: 10,
      }),
      requirement('problem_validation', 'Problem Validation', { status: 'completed' }),
      requirement('customer_persona', 'Customer Persona'),
      requirement('competitor_research', 'Competitor Research'),
      requirement('pricing_willingness', 'Pricing / Willingness to Pay'),
      requirement('key_assumptions', 'Key Assumptions'),
    ]);
    journeyApi.fetchEvidence.mockResolvedValue([
      {
        id: 'e1',
        startup_id: 's',
        requirement_id: 'r-customer_interviews',
        update_id: null,
        stage: 'validation',
        evidence_type: 'customer_feedback',
        label: 'Teacher interview',
        text_value: 'Grading takes all weekend.',
        url: null,
        file_path: null,
        linked_metric_id: null,
        created_by: null,
        created_at: '2026-10-02T00:00:00Z',
      },
    ]);
    api.fetchPublishedUpdates.mockResolvedValue([
      {
        id: 'u1',
        startup_id: 's',
        author_id: null,
        title: 'Interview sprint',
        summary: 'Six interviews',
        highlights: [],
        challenge: null,
        next_steps: null,
        image_path: null,
        link_url: null,
        progress_types: ['Customer Validation'],
        blocker: 'Finding schools',
        next_milestone: 'Reach 10 interviews',
        next_milestone_date: '2026-11-01',
        linked_stage: 'validation',
        status: 'published',
        update_date: '2026-10-05',
        published_at: '2026-10-05T00:00:00Z',
        created_at: '',
        updated_at: '',
      },
    ]);
    renderAt(<JourneyTab startupId="s" current="validation" />);

    const current = await screen.findByRole('region', { name: /^02/ });
    expect(within(current).getByText('1 of 6 requirements completed')).toBeInTheDocument();
    expect(within(current).getByText('Complete 4 more customer interviews')).toBeInTheDocument();
    expect(screen.getByText('Teacher interview')).toBeInTheDocument();
    expect(screen.getByText('Grading takes all weekend.')).toBeInTheDocument();
    expect(screen.getByText('Interview sprint')).toBeInTheDocument();
    expect(screen.getByText('Finding schools')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    // Read-only: no founder actions.
    expect(
      screen.queryByRole('button', { name: /Update|Add Evidence|Remove|Select Metrics/ }),
    ).not.toBeInTheDocument();
    // Locked stages are shown but not selectable.
    expect(screen.queryByRole('button', { name: /Investor Readiness/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Investor Access — Locked')).toBeInTheDocument();
  });

  it('says when a founder has not started', async () => {
    journeyApi.fetchRequirements.mockResolvedValue([
      requirement('problem_statement', 'Problem Statement', { stage: 'idea' }),
    ]);
    api.fetchPublishedUpdates.mockResolvedValue([]);
    renderAt(<JourneyTab startupId="s" current="idea" />);
    expect(
      await screen.findByText('This founder has not started their journey requirements yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No evidence uploaded yet.')).toBeInTheDocument();
  });
});

describe('AdminStartupsPage', () => {
  it('renders the database rows with activity labels', async () => {
    api.fetchStartupList.mockResolvedValue({ rows: [listRow], total: 1 });
    renderAt(<AdminStartupsPage />);
    const table = await screen.findByRole('table', { name: 'Startups' });
    expect(within(table).getByRole('link', { name: /Gamma Labs/ })).toHaveAttribute(
      'href',
      '/admin/startups/startup-1',
    );
    expect(within(table).getByText('1 240 000 UZS')).toBeInTheDocument();
    expect(within(table).getByText('+24%')).toBeInTheDocument();
    expect(within(table).getByText('Needs Update')).toBeInTheDocument();
    expect(within(table).getByText('Unassigned')).toBeInTheDocument();
  });

  it('sends search, filters and sort to the database query', async () => {
    const user = userEvent.setup();
    api.fetchStartupList.mockResolvedValue({ rows: [listRow], total: 1 });
    renderAt(<AdminStartupsPage />);
    await screen.findByRole('table', { name: 'Startups' });
    await user.type(screen.getByLabelText('Search'), 'gam');
    await vi.waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('q=gam'));
    await user.selectOptions(screen.getByLabelText('Activity'), 'inactive');
    await user.selectOptions(screen.getByLabelText('Mentor'), 'unassigned');
    await user.selectOptions(screen.getByLabelText('Sort'), 'growth');
    await vi.waitFor(() =>
      expect(api.fetchStartupList).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'gam',
          activity: 'inactive',
          mentor: 'unassigned',
          sort: 'growth',
          page: 1,
        }),
      ),
    );
  });

  it('distinguishes "no startups" from "no matches"', async () => {
    api.fetchStartupList.mockResolvedValue({ rows: [], total: 0 });
    renderAt(<AdminStartupsPage />);
    expect(await screen.findByText('No startups yet')).toBeInTheDocument();
  });

  it('shows a filtered empty state', async () => {
    api.fetchStartupList.mockResolvedValue({ rows: [], total: 0 });
    renderAt(<AdminStartupsPage />, '/?stage=traction');
    expect(await screen.findByText('No startups match these filters')).toBeInTheDocument();
  });
});

describe('UpdatesTab', () => {
  it('shows published updates only', async () => {
    api.fetchPublishedUpdates.mockResolvedValue([
      {
        id: 'u1',
        startup_id: 's',
        author_id: null,
        title: 'Public update',
        summary: 'Done',
        highlights: [],
        challenge: null,
        next_steps: null,
        image_path: null,
        link_url: null,
        progress_types: [],
        blocker: null,
        next_milestone: null,
        next_milestone_date: null,
        linked_stage: null,
        status: 'published',
        update_date: '2026-10-05',
        published_at: '2026-10-05T00:00:00Z',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'u2',
        startup_id: 's',
        author_id: null,
        title: 'Secret draft',
        summary: null,
        highlights: [],
        challenge: null,
        next_steps: null,
        image_path: null,
        link_url: null,
        progress_types: [],
        blocker: null,
        next_milestone: null,
        next_milestone_date: null,
        linked_stage: null,
        status: 'draft',
        update_date: '2026-10-06',
        published_at: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    renderAt(<UpdatesTab startupId="s" />);
    expect(await screen.findByText('Public update')).toBeInTheDocument();
    expect(screen.queryByText('Secret draft')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Publish|Delete/ })).not.toBeInTheDocument();
  });
});

describe('MentorDialog', () => {
  it('creates a mentor from the form', async () => {
    const user = userEvent.setup();
    api.createMentor.mockResolvedValue({ id: 'new-mentor', photo_path: null });
    renderAt(<MentorDialog open onOpenChange={() => {}} mentor={null} />);
    await user.type(screen.getByLabelText(/Full name/), 'Kamola Saidova');
    await user.type(screen.getByLabelText(/Expertise/), 'Product, Growth');
    await user.type(screen.getByLabelText(/Telegram/), '@kamola_s');
    await user.click(screen.getByRole('button', { name: 'Create Mentor' }));
    await vi.waitFor(() => expect(api.createMentor).toHaveBeenCalled());
    expect(api.createMentor.mock.calls[0]![0]).toEqual({
      name: 'Kamola Saidova',
      title: null,
      email: null,
      telegram: '@kamola_s',
      linkedin_url: null,
      expertise: ['Product', 'Growth'],
      bio: null,
      is_active: true,
    });
  });

  it('edits an existing mentor', async () => {
    const user = userEvent.setup();
    api.updateMentor.mockResolvedValue(undefined);
    renderAt(<MentorDialog open onOpenChange={() => {}} mentor={mentor() as never} />);
    const name = screen.getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, 'Aziz K.');
    await user.click(screen.getByLabelText(/Active/));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await vi.waitFor(() =>
      expect(api.updateMentor).toHaveBeenCalledWith(
        'mentor-1',
        expect.objectContaining({ name: 'Aziz K.', is_active: false }),
      ),
    );
    expect(api.createMentor).not.toHaveBeenCalled();
  });
});

describe('MentorTab', () => {
  const current = {
    id: 'a2',
    assigned_at: '2026-10-02T00:00:00Z',
    ended_at: null,
    mentor: mentor(),
  };
  const previous = {
    id: 'a1',
    assigned_at: '2026-09-01T00:00:00Z',
    ended_at: '2026-10-02T00:00:00Z',
    mentor: mentor({ id: 'mentor-0', name: 'Old Mentor' }),
  };

  beforeEach(() => {
    api.fetchAssignments.mockResolvedValue([current, previous]);
    api.fetchAdminNotes.mockResolvedValue([
      {
        id: 'n1',
        body: 'Focus on retention.',
        note_date: '2026-10-03',
        created_at: '',
        mentor: { id: 'mentor-1', name: 'Aziz Karimov' },
        author: { full_name: 'Admin User', email: 'admin@example.com' },
      },
    ]);
    api.assignMentor.mockResolvedValue(undefined);
    api.endAssignment.mockResolvedValue(undefined);
    api.addMentorNote.mockResolvedValue(undefined);
  });

  it('shows the current mentor, history and notes with author', async () => {
    renderAt(<MentorTab startupId="startup-1" startupName="Gamma Labs" />);
    expect(await screen.findByText('Aziz Karimov', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Old Mentor')).toBeInTheDocument();
    expect(screen.getByText('Focus on retention.')).toBeInTheDocument();
    expect(screen.getByText(/Added by Admin User/)).toBeInTheDocument();
  });

  it('switches to another mentor', async () => {
    const user = userEvent.setup();
    renderAt(<MentorTab startupId="startup-1" startupName="Gamma Labs" />);
    await user.click(await screen.findByRole('button', { name: 'Change mentor' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change mentor' });
    await user.selectOptions(await within(dialog).findByLabelText('Mentor'), 'mentor-2');
    await user.click(within(dialog).getByRole('button', { name: 'Assign mentor' }));
    await vi.waitFor(() => expect(api.assignMentor).toHaveBeenCalledWith('startup-1', 'mentor-2'));
  });

  it('removes the assignment after confirmation', async () => {
    const user = userEvent.setup();
    renderAt(<MentorTab startupId="startup-1" startupName="Gamma Labs" />);
    await user.click(await screen.findByRole('button', { name: 'Remove assignment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove mentor assignment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove assignment' }));
    await vi.waitFor(() => expect(api.endAssignment).toHaveBeenCalledWith('startup-1'));
  });

  it('adds a mentor note on behalf of the current mentor', async () => {
    const user = userEvent.setup();
    renderAt(<MentorTab startupId="startup-1" startupName="Gamma Labs" />);
    await user.type(
      await screen.findByLabelText(/New note from Aziz Karimov/),
      'Talk to ten customers.',
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await vi.waitFor(() =>
      expect(api.addMentorNote).toHaveBeenCalledWith(
        expect.objectContaining({
          startupId: 'startup-1',
          mentorId: 'mentor-1',
          body: 'Talk to ten customers.',
        }),
      ),
    );
  });

  it('asks for a mentor before notes when none is assigned', async () => {
    api.fetchAssignments.mockResolvedValue([previous]);
    renderAt(<MentorTab startupId="startup-1" startupName="Gamma Labs" />);
    expect(await screen.findByText('No mentor assigned')).toBeInTheDocument();
    expect(screen.getByText('Assign a mentor to add notes on their behalf.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign mentor' })).toBeInTheDocument();
  });
});

describe('AdminMeetingRequestsPage', () => {
  const request = {
    id: 'r1',
    startup_id: 'startup-1',
    mentor_id: 'mentor-1',
    requested_by: null,
    reason: 'Fundraising',
    message: 'Pitch deck review',
    preferred_date: '2026-10-20',
    status: 'requested',
    admin_response: null,
    created_at: '2026-10-07T00:00:00Z',
    updated_at: '2026-10-07T00:00:00Z',
    startup: {
      id: 'startup-1',
      name: 'Gamma Labs',
      owner: { full_name: 'Dilnoza Yusupova', email: 'd@example.com' },
    },
    mentor: { id: 'mentor-1', name: 'Aziz Karimov' },
  };

  it('lists requests and confirms one with an admin note', async () => {
    const user = userEvent.setup();
    api.fetchMeetingRequests.mockResolvedValue({ rows: [request], total: 1 });
    api.updateMeetingRequest.mockResolvedValue(undefined);
    renderAt(<AdminMeetingRequestsPage />);
    const table = await screen.findByRole('table', { name: 'Meeting requests' });
    expect(within(table).getByText('Dilnoza Yusupova')).toBeInTheDocument();
    expect(within(table).getByText('Requested')).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'Manage' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage meeting request' });
    await user.selectOptions(within(dialog).getByLabelText(/Status/), 'confirmed');
    await user.type(within(dialog).getByLabelText(/Admin note/), 'Tuesday 10:00, room 204');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() =>
      expect(api.updateMeetingRequest).toHaveBeenCalledWith('r1', {
        status: 'confirmed',
        admin_response: 'Tuesday 10:00, room 204',
      }),
    );
  });

  it('filters by status through the query', async () => {
    const user = userEvent.setup();
    api.fetchMeetingRequests.mockResolvedValue({ rows: [], total: 0 });
    renderAt(<AdminMeetingRequestsPage />);
    expect(await screen.findByText('No meeting requests')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Declined' }));
    await vi.waitFor(() =>
      expect(api.fetchMeetingRequests).toHaveBeenLastCalledWith('declined', 1),
    );
  });
});
