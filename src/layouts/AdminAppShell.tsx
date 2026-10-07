import { paths } from '@/app/paths';
import { AppShell } from './AppShell';
import { useAuth } from '@/features/auth/useAuth';
import { adminNavItems, superadminNavItem } from './nav';

export function AdminAppShell() {
  const { profile } = useAuth();
  const navItems =
    profile?.role === 'superadmin' ? [...adminNavItems, superadminNavItem] : adminNavItems;
  return (
    <AppShell
      navItems={navItems}
      workspaceLabel="Startup Oversight"
      signedOutPath={paths.adminLogin}
      navLabel="Admin navigation"
    />
  );
}
