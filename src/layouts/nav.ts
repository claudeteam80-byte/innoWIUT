import {
  Building2,
  CalendarClock,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { paths } from '@/app/paths';
import type { NavItem } from './AppShell';

// Mentor Directory, Help and standalone Team Management are intentionally hidden in V1.
export const founderNavItems: NavItem[] = [
  { label: 'Overview', to: paths.founder.dashboard, icon: LayoutDashboard },
  { label: 'Updates', to: paths.founder.updates, icon: FileText },
  { label: 'Traction', to: paths.founder.traction, icon: TrendingUp },
  { label: 'Mentor', to: paths.founder.mentor, icon: UserRound },
  { label: 'Startup Profile', to: paths.founder.startup, icon: Building2 },
  { label: 'Settings', to: paths.founder.settings, icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { label: 'Ecosystem Overview', to: paths.admin.dashboard, icon: LayoutDashboard, end: true },
  { label: 'Startups', to: paths.admin.startups, icon: Building2 },
  { label: 'Mentors', to: paths.admin.mentors, icon: Users },
  { label: 'Meeting Requests', to: paths.admin.meetingRequests, icon: CalendarClock },
  { label: 'Settings', to: paths.admin.settings, icon: Settings },
];
