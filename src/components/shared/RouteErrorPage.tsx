import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { isChunkLoadError, reloadOnceForNewVersion } from '@/lib/chunk-reload';
import { CenteredMessage } from './CenteredMessage';
import { NotFoundPage } from './NotFoundPage';

/** Shown instead of a blank screen when a page fails to load or render. */
export function RouteErrorPage() {
  const error = useRouteError();
  const staleVersion = isChunkLoadError(error);

  useEffect(() => {
    if (staleVersion) reloadOnceForNewVersion();
    else console.error(error);
  }, [error, staleVersion]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <CenteredMessage
      title={staleVersion ? 'A new version is available' : 'Something went wrong'}
      actions={
        <>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <a href={paths.root} className={buttonClasses({ variant: 'outline' })}>
            Go to start
          </a>
        </>
      }
    >
      <p>
        {staleVersion
          ? 'FounderTrack was updated while this page was open. Reload to continue — your saved work is safe.'
          : 'This page could not be displayed. Reload to try again. If it keeps happening, sign out and back in.'}
      </p>
    </CenteredMessage>
  );
}
