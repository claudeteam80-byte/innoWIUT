import { Spinner } from '@/components/ui/Spinner';

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Spinner label={label} />
    </div>
  );
}

export function SectionSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner label={label} />
    </div>
  );
}
