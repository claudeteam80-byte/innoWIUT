import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { paths } from '@/app/paths';
import { useAuth } from '@/features/auth/useAuth';
import { CenteredMessage } from './CenteredMessage';

/** Shown when a signed-in user's profile (or onboarding status) cannot be loaded. */
export function AccountErrorState({ onRetry }: { onRetry?: () => void }) {
  const { refetchProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      navigate(paths.authChoice, { replace: true });
    }
  }

  return (
    <CenteredMessage
      title="We couldn't load your account"
      actions={
        <>
          <Button onClick={onRetry ?? refetchProfile}>Try again</Button>
          <Button variant="outline" loading={signingOut} onClick={handleSignOut}>
            Sign out
          </Button>
        </>
      }
    >
      <p>
        Check your connection and try again. If this keeps happening, contact the innoWIUT team.
      </p>
    </CenteredMessage>
  );
}
