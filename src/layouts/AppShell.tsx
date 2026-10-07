import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/text';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

interface AppShellProps {
  navItems: NavItem[];
  /** Small label under the brand and in the top bar, e.g. "Founder Workspace". */
  workspaceLabel: string;
  /** Where to go after signing out. */
  signedOutPath: string;
  navLabel: string;
}

export function AppShell({ navItems, workspaceLabel, signedOutPath, navLabel }: AppShellProps) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = profile?.full_name || user?.email || '';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      navigate(signedOutPath, { replace: true });
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-navy px-4 py-5">
      <div className="flex items-center justify-between px-2">
        <BrandMark inverted subtitle={workspaceLabel} />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label={navLabel} className="mt-8 flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-white shadow-nav-active'
                  : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-navy/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85vw]">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold text-ink">innoWIUT</span>
          <span className="h-4 w-px bg-line" aria-hidden="true" />
          <span className="truncate text-[13px] text-muted">{workspaceLabel}</span>
          <div className="flex-1" />
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-medium text-ink">{profile?.full_name || 'Signed in'}</p>
            <p className="text-[12px] text-muted">{profile?.email ?? user?.email}</p>
          </div>
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary"
            aria-hidden="true"
          >
            {initials(displayName)}
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
