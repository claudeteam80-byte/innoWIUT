import { paths } from '@/app/paths';
import { AppShell } from './AppShell';
import { founderNavItems } from './nav';

export function FounderAppShell() {
  return (
    <AppShell
      navItems={founderNavItems}
      workspaceLabel="Founder Workspace"
      signedOutPath={paths.founderLogin}
      navLabel="Founder navigation"
    />
  );
}
