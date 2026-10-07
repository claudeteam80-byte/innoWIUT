import { lazy, type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '@/components/shared/NotFoundPage';
import { RouteErrorPage } from '@/components/shared/RouteErrorPage';
import { AdminLoginPage } from '@/features/auth/pages/AdminLoginPage';
import { AuthChoicePage } from '@/features/auth/pages/AuthChoicePage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { FounderLoginPage } from '@/features/auth/pages/FounderLoginPage';
import { FounderSignupPage } from '@/features/auth/pages/FounderSignupPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { AdminAppShell } from '@/layouts/AdminAppShell';
import { FounderAppShell } from '@/layouts/FounderAppShell';
import { RequireOnboarding } from '@/routes/guards/RequireOnboarding';
import { RequireRole } from '@/routes/guards/RequireRole';
import { RootRedirect } from '@/routes/guards/RootRedirect';
import { paths } from './paths';

/** Signed-in pages load on demand so the sign-in screens stay small. */
function page<T>(load: () => Promise<T>, pick: (module: T) => ComponentType) {
  return lazy(() => load().then((module) => ({ default: pick(module) })));
}

const OnboardingPage = page(
  () => import('@/features/onboarding/pages/OnboardingPage'),
  (m) => m.OnboardingPage,
);
const DashboardPage = page(
  () => import('@/features/dashboard/pages/DashboardPage'),
  (m) => m.DashboardPage,
);
const UpdatesPage = page(
  () => import('@/features/updates/pages/UpdatesPage'),
  (m) => m.UpdatesPage,
);
const TractionPage = page(
  () => import('@/features/traction/pages/TractionPage'),
  (m) => m.TractionPage,
);
const MentorPage = page(
  () => import('@/features/mentor/pages/MentorPage'),
  (m) => m.MentorPage,
);
const StartupProfilePage = page(
  () => import('@/features/startup/pages/StartupProfilePage'),
  (m) => m.StartupProfilePage,
);
const SettingsPage = page(
  () => import('@/features/settings/pages/SettingsPage'),
  (m) => m.SettingsPage,
);
const AdminDashboardPage = page(
  () => import('@/features/admin/pages/AdminDashboardPage'),
  (m) => m.AdminDashboardPage,
);
const AdminStartupsPage = page(
  () => import('@/features/admin/pages/AdminStartupsPage'),
  (m) => m.AdminStartupsPage,
);
const AdminStartupDetailPage = page(
  () => import('@/features/admin/pages/AdminStartupDetailPage'),
  (m) => m.AdminStartupDetailPage,
);
const AdminMentorsPage = page(
  () => import('@/features/admin/pages/AdminMentorsPage'),
  (m) => m.AdminMentorsPage,
);
const AdminMeetingRequestsPage = page(
  () => import('@/features/admin/pages/AdminMeetingRequestsPage'),
  (m) => m.AdminMeetingRequestsPage,
);
const AdminAccessPage = page(
  () => import('@/features/admin/pages/AdminAccessPage'),
  (m) => m.AdminAccessPage,
);
const AdminSettingsPage = page(
  () => import('@/features/admin/pages/AdminSettingsPage'),
  (m) => m.AdminSettingsPage,
);

const appRoutes: RouteObject[] = [
  { path: paths.root, element: <RootRedirect /> },

  // Public auth screens
  { path: paths.authChoice, element: <AuthChoicePage /> },
  { path: paths.founderLogin, element: <FounderLoginPage /> },
  { path: paths.founderSignup, element: <FounderSignupPage /> },
  { path: paths.founderVerifyEmail, element: <VerifyEmailPage /> },
  { path: paths.adminLogin, element: <AdminLoginPage /> },
  { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
  { path: paths.resetPassword, element: <ResetPasswordPage /> },
  { path: '/login', element: <Navigate to={paths.authChoice} replace /> },
  { path: '/register', element: <Navigate to={paths.founderSignup} replace /> },

  // Founder area
  {
    element: <RequireRole role="founder" />,
    children: [
      {
        element: <RequireOnboarding require="incomplete" />,
        children: [{ path: paths.founder.onboarding, element: <OnboardingPage /> }],
      },
      {
        element: <RequireOnboarding require="complete" />,
        children: [
          {
            element: <FounderAppShell />,
            children: [
              {
                path: paths.founder.root,
                element: <Navigate to={paths.founder.dashboard} replace />,
              },
              { path: paths.founder.dashboard, element: <DashboardPage /> },
              { path: paths.founder.updates, element: <UpdatesPage /> },
              { path: paths.founder.traction, element: <TractionPage /> },
              { path: paths.founder.mentor, element: <MentorPage /> },
              { path: paths.founder.startup, element: <StartupProfilePage /> },
              { path: paths.founder.settings, element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Admin area (no public admin signup route exists)
  {
    element: <RequireRole role="admin" />,
    children: [
      {
        element: <AdminAppShell />,
        children: [
          { path: paths.admin.root, element: <Navigate to={paths.admin.dashboard} replace /> },
          { path: paths.admin.dashboard, element: <AdminDashboardPage /> },
          { path: paths.admin.startups, element: <AdminStartupsPage /> },
          { path: `${paths.admin.startups}/:id`, element: <AdminStartupDetailPage /> },
          { path: paths.admin.mentors, element: <AdminMentorsPage /> },
          { path: paths.admin.meetingRequests, element: <AdminMeetingRequestsPage /> },
          { path: paths.admin.settings, element: <AdminSettingsPage /> },
          {
            // Superadmin only. Regular admins are redirected to the admin dashboard.
            element: <RequireRole role="superadmin" />,
            children: [{ path: paths.admin.access, element: <AdminAccessPage /> }],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
];

/** One error boundary for every page, so a failure never leaves a blank screen. */
export const routes: RouteObject[] = [{ errorElement: <RouteErrorPage />, children: appRoutes }];
