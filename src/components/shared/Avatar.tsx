import { useState } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/text';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  className?: string;
}

const sizes = {
  sm: 'h-9 w-9 text-[12px]',
  md: 'h-12 w-12 text-[14px]',
  lg: 'h-16 w-16 text-[18px]',
  xl: 'h-20 w-20 text-[22px]',
};

/** Image with an initials placeholder when there is no image or it fails to load. */
export function Avatar({ name, src, size = 'md', shape = 'square', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden bg-primary-soft font-semibold text-primary',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
