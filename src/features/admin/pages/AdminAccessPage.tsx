import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { formatDate, formatRelativeDay } from '@/domain/dates';
import { ROLE_META } from '@/domain/roles';
import { emailSchema } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/useAuth';
import { errorMessage } from '@/lib/errors';
import {
  accessKeys,
  fetchAdminUsers,
  fetchRoleEvents,
  findUserByEmail,
  grantAdminAccess,
  promoteToSuperadmin,
  revokeAdminAccess,
  type AdminUser,
  type FoundUser,
} from '../access-api';

const SELF_CONFIRMATION = 'REMOVE MY ACCESS';

export function AdminAccessPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: accessKeys.users, queryFn: fetchAdminUsers });
  const events = useQuery({ queryKey: accessKeys.events, queryFn: () => fetchRoleEvents() });
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<AdminUser | null>(null);
  const [promoting, setPromoting] = useState<AdminUser | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Superadmin"
        title="Admin Access"
        subtitle="Everyone who can open the innoWIUT admin area. Each admin signs in with their own account."
        actions={
          <Button onClick={() => setGranting(true)}>
            <UserPlus aria-hidden="true" /> Grant Admin Access
          </Button>
        }
      />

      <Card>
        <CardHeader title="Admin users" />
        {users.isError ? (
          <ErrorState
            description="We couldn't load admin users."
            onRetry={() => void users.refetch()}
          />
        ) : users.isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading admin users">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : users.data.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No admin users"
            description="Grant admin access to an existing account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Admin users</caption>
              <thead className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th scope="col" className="py-2.5 pr-3">
                    Name
                  </th>
                  <th scope="col" className="py-2.5 pr-3">
                    Email
                  </th>
                  <th scope="col" className="py-2.5 pr-3">
                    Role
                  </th>
                  <th scope="col" className="py-2.5 pr-3 whitespace-nowrap">
                    Added Date
                  </th>
                  <th scope="col" className="py-2.5 pr-3">
                    Status
                  </th>
                  <th scope="col" className="py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((admin) => {
                  const isSelf = admin.id === user?.id;
                  return (
                    <tr key={admin.id} className="border-b border-line/70 last:border-0">
                      <td className="py-3 pr-3 font-medium text-ink">
                        {admin.full_name || '—'}
                        {isSelf && (
                          <span className="ml-2 text-[12px] font-normal text-muted">(you)</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-muted">{admin.email}</td>
                      <td className="py-3 pr-3">
                        <Badge tone={ROLE_META[admin.role].tone}>
                          {ROLE_META[admin.role].label}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-muted">
                        {formatDate(admin.added_at)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-muted">
                        {admin.last_sign_in_at
                          ? `Signed in ${formatRelativeDay(admin.last_sign_in_at).toLowerCase()}`
                          : 'Never signed in'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {admin.role === 'admin' && (
                            <Button variant="outline" size="sm" onClick={() => setPromoting(admin)}>
                              Promote to Superadmin
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setRevoking(admin)}>
                            Revoke Access
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Role change history"
          description="Every change to admin and superadmin access, newest first."
        />
        {events.isError ? (
          <ErrorState onRetry={() => void events.refetch()} />
        ) : events.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : events.data.length === 0 ? (
          <EmptyState
            icon={History}
            title="No role changes yet"
            description="Grants, promotions and revocations appear here."
          />
        ) : (
          <ol className="divide-y divide-line">
            {events.data.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-[13px]"
              >
                <p className="text-ink">
                  <span className="font-medium">{event.target_email}</span>:{' '}
                  {ROLE_META[event.previous_role].label} → {ROLE_META[event.new_role].label}
                  <span className="text-muted">
                    {' '}
                    · by{' '}
                    {event.actor?.full_name ||
                      event.actor?.email ||
                      event.changed_by_email ||
                      'SQL editor (manual)'}
                  </span>
                </p>
                <span className="text-[12px] text-subtle">{formatDate(event.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <div className="flex gap-3 text-[13px] text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Role changes are enforced by the database: only superadmins can change them, nobody can
            change their own role without explicit confirmation, every change is recorded, and the
            last superadmin can never be removed.
          </p>
        </div>
      </Card>

      <GrantDialog open={granting} onOpenChange={setGranting} onDone={refresh} />
      <RevokeDialog
        target={revoking}
        isSelf={revoking?.id === user?.id}
        onClose={() => setRevoking(null)}
        onDone={refresh}
      />
      <PromoteDialog target={promoting} onClose={() => setPromoting(null)} onDone={refresh} />
    </div>
  );
}

type Lookup =
  { state: 'idle' } | { state: 'found'; user: FoundUser } | { state: 'missing'; email: string };

function GrantDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<unknown>;
}) {
  return open ? <GrantForm onOpenChange={onOpenChange} onDone={onDone} /> : null;
}

function GrantForm({
  onOpenChange,
  onDone,
}: {
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<unknown>;
}) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [confirmed, setConfirmed] = useState(false);

  const find = useMutation({
    mutationFn: findUserByEmail,
    onSuccess: (found, searched) => {
      setConfirmed(false);
      setLookup(found ? { state: 'found', user: found } : { state: 'missing', email: searched });
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't look up that email.")),
  });

  const grant = useMutation({
    mutationFn: (target: FoundUser) => grantAdminAccess(target.email),
    onSuccess: async (_, target) => {
      await onDone();
      toast.success(`${target.full_name || target.email} now has admin access.`);
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't grant admin access.")),
  });

  const search = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
      return;
    }
    setEmailError(null);
    find.mutate(parsed.data);
  };

  const found = lookup.state === 'found' ? lookup.user : null;
  const canGrant = found?.role === 'founder' && !found.owns_startup;

  return (
    <Dialog
      open
      onOpenChange={(next) => !grant.isPending && onOpenChange(next)}
      title="Grant admin access"
      description="Admin access can only be given to someone who already has an innoWIUT account."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={grant.isPending}>
            Cancel
          </Button>
          {canGrant && (
            <Button
              onClick={() => found && grant.mutate(found)}
              disabled={!confirmed}
              loading={grant.isPending}
            >
              Grant Admin Access
            </Button>
          )}
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
        noValidate
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <TextField
          label="Email"
          type="email"
          className="flex-1"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setLookup({ state: 'idle' });
          }}
          error={emailError ?? undefined}
        />
        <Button type="submit" variant="outline" loading={find.isPending}>
          Find account
        </Button>
      </form>

      <div className="mt-4 space-y-3">
        {lookup.state === 'missing' && (
          <Alert tone="info">
            <p className="font-medium">
              This user needs an account before admin access can be granted.
            </p>
            <p className="mt-1">
              Ask them to create an account at <span className="font-medium">/founder/signup</span>{' '}
              with {lookup.email} and verify their email (they should not complete onboarding). Then
              search for them again here.
            </p>
          </Alert>
        )}
        {found && (
          <div className="rounded-lg border border-line p-4">
            <p className="text-[14px] font-semibold text-ink">{found.full_name || 'No name set'}</p>
            <p className="text-[13px] text-muted">{found.email}</p>
            <p className="mt-2 text-[12.5px]">
              Current role:{' '}
              <Badge tone={ROLE_META[found.role].tone}>{ROLE_META[found.role].label}</Badge>
            </p>
          </div>
        )}
        {found && found.role !== 'founder' && (
          <Alert tone="info">This user already has admin access.</Alert>
        )}
        {found && found.role === 'founder' && found.owns_startup && (
          <Alert tone="error">
            This account owns a startup, so it cannot become an admin. Ask the person to use a
            separate email address for admin access.
          </Alert>
        )}
        {canGrant && (
          <CheckboxField
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            label={`I confirm that ${found?.full_name || found?.email} should have admin access to every startup, mentor and meeting request.`}
          />
        )}
      </div>
    </Dialog>
  );
}

function RevokeDialog({
  target,
  isSelf,
  onClose,
  onDone,
}: {
  target: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [typed, setTyped] = useState('');
  const revoke = useMutation({
    mutationFn: (admin: AdminUser) => revokeAdminAccess(admin.id, isSelf),
    onSuccess: async (_, admin) => {
      await onDone();
      toast.success(`${admin.full_name || admin.email} no longer has admin access.`);
      setTyped('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't revoke admin access.")),
  });

  if (!target) return null;
  if (!isSelf) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={`Revoke access for ${target.full_name || target.email}?`}
        description="Their admin access ends immediately and the app removes them from the admin area within a minute. Their account becomes a regular founder account."
        confirmLabel="Revoke Access"
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate(target)}
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setTyped('');
          onClose();
        }
      }}
      title="Remove your own admin access?"
      description="You will lose access to the admin area immediately. This cannot be undone by you."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={revoke.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={typed !== SELF_CONFIRMATION}
            loading={revoke.isPending}
            onClick={() => revoke.mutate(target)}
          >
            Remove my access
          </Button>
        </>
      }
    >
      <TextField
        label={`Type ${SELF_CONFIRMATION} to confirm`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
      />
    </Dialog>
  );
}

function PromoteDialog({
  target,
  onClose,
  onDone,
}: {
  target: AdminUser | null;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [typed, setTyped] = useState('');
  const promote = useMutation({
    mutationFn: (admin: AdminUser) => promoteToSuperadmin(admin.id, typed),
    onSuccess: async (_, admin) => {
      await onDone();
      toast.success(`${admin.full_name || admin.email} is now a superadmin.`);
      setTyped('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't promote this admin.")),
  });
  if (!target) return null;
  const matches = typed.trim().toLowerCase() === target.email.toLowerCase();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setTyped('');
          onClose();
        }
      }}
      title="Promote to superadmin?"
      description={`${target.full_name || target.email} will be able to grant, revoke and promote admin access — including yours.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={promote.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!matches}
            loading={promote.isPending}
            onClick={() => promote.mutate(target)}
          >
            Promote to Superadmin
          </Button>
        </>
      }
    >
      <TextField
        label={`Type ${target.email} to confirm`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
      />
    </Dialog>
  );
}
