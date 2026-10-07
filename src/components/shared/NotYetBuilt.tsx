import { Construction } from 'lucide-react';
import { EmptyState } from './EmptyState';

/** Honest placeholder for screens whose features land in a later phase. No sample data. */
export function NotYetBuilt({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon={Construction}
      title={`${feature} is not available yet`}
      description="This section is being built. It will show your real innoWIUT data once it is ready."
    />
  );
}
