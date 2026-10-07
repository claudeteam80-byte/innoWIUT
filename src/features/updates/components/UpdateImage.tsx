import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { useSignedImageUrl } from '../hooks';

/** Private attachment shown through a short-lived signed URL; regenerates once if it expired. */
export function UpdateImage({ path, alt }: { path: string; alt: string }) {
  const signed = useSignedImageUrl(path);
  const [retried, setRetried] = useState(false);
  const [broken, setBroken] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  if (signed.isError || broken) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center gap-2 rounded-lg bg-canvas text-[12.5px] text-muted">
        <ImageOff className="h-4 w-4" aria-hidden="true" /> Image unavailable
      </div>
    );
  }
  const loaded = Boolean(signed.data) && loadedSrc === signed.data;
  return (
    <div className="relative overflow-hidden rounded-lg">
      {!loaded && <Skeleton className="aspect-[16/9] w-full rounded-lg" />}
      {signed.data && (
        <img
          src={signed.data}
          alt={alt}
          loading="lazy"
          className={cn(
            'max-h-[420px] w-full rounded-lg border border-line object-cover',
            !loaded && 'absolute inset-0 opacity-0',
          )}
          onLoad={() => setLoadedSrc(signed.data ?? null)}
          onError={() => {
            if (retried) {
              setBroken(true);
              return;
            }
            setRetried(true);
            void signed.refetch();
          }}
        />
      )}
    </div>
  );
}
