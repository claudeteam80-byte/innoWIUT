import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { buttonClasses } from '@/components/ui/button-styles';
import { CenteredMessage } from './CenteredMessage';

export function NotFoundPage() {
  return (
    <CenteredMessage
      title="Page not found"
      actions={
        <Link to={paths.root} className={buttonClasses()}>
          Go to innoWIUT
        </Link>
      }
    >
      <p>The page you are looking for doesn&apos;t exist or has moved.</p>
    </CenteredMessage>
  );
}
