import { PageHeader } from './PageHeader';
import { NotYetBuilt } from './NotYetBuilt';

interface PlaceholderPageProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  feature?: string;
}

export function PlaceholderPage({ eyebrow, title, subtitle, feature }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <NotYetBuilt feature={feature ?? title} />
    </div>
  );
}
