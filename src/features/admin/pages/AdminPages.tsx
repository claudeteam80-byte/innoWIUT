import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { paths } from '@/app/paths';
import { PlaceholderPage } from '@/components/shared/PlaceholderPage';

export function AdminDashboardPage() {
  return (
    <PlaceholderPage
      eyebrow="innoWIUT"
      title="Ecosystem Overview"
      subtitle="Monitor startup activity and traction across the ecosystem."
    />
  );
}

export function AdminStartupsPage() {
  return (
    <PlaceholderPage
      eyebrow="innoWIUT"
      title="Startups"
      subtitle="Search, filter and open any startup in the ecosystem."
    />
  );
}

export function AdminStartupDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <Link
        to={paths.admin.startups}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Startups
      </Link>
      <PlaceholderPage
        eyebrow="Startup"
        title="Startup detail"
        subtitle={id ? `Startup ID ${id}` : undefined}
        feature="Startup detail"
      />
    </div>
  );
}

export function AdminMentorsPage() {
  return (
    <PlaceholderPage
      eyebrow="innoWIUT"
      title="Mentors"
      subtitle="Every mentor in the ecosystem and the startups they work with."
    />
  );
}

export function AdminSettingsPage() {
  return (
    <PlaceholderPage
      eyebrow="Administration"
      title="Admin Settings"
      subtitle="Your administrator account, sign-in policy and session."
      feature="Admin settings"
    />
  );
}
