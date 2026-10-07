import { PlaceholderPage } from '@/components/shared/PlaceholderPage';
import { useAuth } from '@/features/auth/useAuth';
import { firstName } from '@/lib/text';

export function FounderDashboardPage() {
  const { profile } = useAuth();
  const name = firstName(profile?.full_name);
  return (
    <PlaceholderPage
      eyebrow="Overview"
      title={name ? `Welcome, ${name}` : 'Welcome'}
      subtitle="Here's what's happening with your startup."
      feature="Your startup overview"
    />
  );
}

export function FounderUpdatesPage() {
  return (
    <PlaceholderPage
      eyebrow="Updates"
      title="Startup Updates"
      subtitle="Post simple progress updates so innoWIUT can follow what you ship."
      feature="Updates"
    />
  );
}

export function FounderTractionPage() {
  return (
    <PlaceholderPage
      eyebrow="Traction"
      title="Traction"
      subtitle="Track the numbers that matter to your startup."
    />
  );
}

export function FounderMentorPage() {
  return (
    <PlaceholderPage
      eyebrow="Mentor"
      title="Your Mentor"
      subtitle="Guidance and contact details for your assigned innoWIUT mentor."
      feature="Mentor"
    />
  );
}

export function FounderStartupProfilePage() {
  return (
    <PlaceholderPage
      eyebrow="Startup Profile"
      title="Startup Profile"
      subtitle="Keep your company information and team accurate for innoWIUT."
    />
  );
}

export function FounderSettingsPage() {
  return (
    <PlaceholderPage
      eyebrow="Settings"
      title="Settings"
      subtitle="Your founder profile, password and notification preferences."
    />
  );
}
