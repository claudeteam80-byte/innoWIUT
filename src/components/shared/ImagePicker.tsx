import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MAX_IMAGE_BYTES, validateImage, type ImageBucket } from '@/lib/storage';

interface ImagePickerProps {
  label: string;
  bucket: ImageBucket;
  /** Currently stored image URL (if any). */
  currentUrl?: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onRemoveCurrent?: () => void;
  progress?: number | null;
  disabled?: boolean;
  variant?: 'logo' | 'wide';
}

/** Choose an image, validated against the bucket's type/size rules, with preview and upload progress. */
export function ImagePicker({
  label,
  bucket,
  currentUrl,
  file,
  onFileChange,
  onRemoveCurrent,
  progress,
  disabled,
  variant = 'logo',
}: ImagePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(
    () => (file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = file ? preview : currentUrl;
  const maxMb = Math.round(MAX_IMAGE_BYTES[bucket] / 1024 / 1024);

  return (
    <div className="space-y-2">
      <span className="block text-[13px] font-medium text-ink">{label}</span>
      <div className={variant === 'logo' ? 'flex items-center gap-4' : 'space-y-3'}>
        <div
          className={
            variant === 'logo'
              ? 'grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-canvas'
              : 'grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-canvas'
          }
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-subtle" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {shown ? 'Replace image' : 'Choose image'}
            </Button>
            {(file || currentUrl) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  if (file) onFileChange(null);
                  else onRemoveCurrent?.();
                  setError(null);
                }}
              >
                <Trash2 aria-hidden="true" /> Remove
              </Button>
            )}
          </div>
          <p className="text-[12px] text-muted">PNG, JPG or WebP, up to {maxMb} MB.</p>
          {error && (
            <p role="alert" className="text-[12px] text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      {progress !== null && progress !== undefined && (
        <ProgressBar value={progress} label="Uploading image" />
      )}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (!selected) return;
          const problem = validateImage(selected, bucket);
          setError(problem);
          if (!problem) onFileChange(selected);
        }}
      />
    </div>
  );
}
