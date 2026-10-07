import { Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '@/components/shared/NotFoundPage';
import {
  AdminDashboardPage,
  AdminMentorsPage,
  AdminSettingsPage,
  AdminStartupDetailPage,
  AdminStartupsPage,
} from '@/features/admin/pages/AdminPages';
import { AdminLoginPage } from '@/features/auth/pages/AdminLoginPage';
import { AuthChoicePage } from '@/features/auth/pages/AuthChoicePage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { FounderLoginPage } from '@/features/auth/pages/FounderLoginPage';
import { FounderSignupPage } from '@/features/auth/pages/FounderSignupPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import {
  FounderDashboardPage,
  FounderMentorPage,
  FounderSettingsPage,
  FounderStartupProfilePage,
  FounderTractionPage,
  FounderUpdatesPage,
} from '@/features/founder/pages/FounderPages';
import { OnboardingPage } from '@/features/onboarding/pages/OnboardingPage';
import { AdminAppShell } from '@/layouts/AdminAppShell';
import { FounderAppShell } from '@/layouts/FounderAppShell';
import { RequireOnboarding } from '@/routes/guards/RequireOnboarding';
import { RequireRole } from '@/routes/guards/RequireRole';
import { RootRedirect } from '@/routes/guards/RootRedirect';
import { paths } from './paths';

export const routes: RouteObject[] = [
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
              { path: paths.founder.dashboard, element: <FounderDashboardPage /> },
              { path: paths.founder.updates, element: <FounderUpdatesPage /> },
              { path: paths.founder.traction, element: <FounderTractionPage /> },
              { path: paths.founder.mentor, element: <FounderMentorPage /> },
              { path: paths.founder.startup, element: <FounderStartupProfilePage /> },
              { path: paths.founder.settings, element: <FounderSettingsPage /> },
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
          { path: paths.admin.settings, element: <AdminSettingsPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
];
