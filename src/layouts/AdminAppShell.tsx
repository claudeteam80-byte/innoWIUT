import { paths } from '@/app/paths';
import { AppShell } from './AppShell';
import { adminNavItems } from './nav';

export function AdminAppShell() {
  return (
    <AppShell
      navItems={adminNavItems}
      workspaceLabel="Startup Oversight"
      signedOutPath={paths.adminLogin}
      navLabel="Admin navigation"
    />
  );
}
