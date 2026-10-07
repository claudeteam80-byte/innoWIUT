export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[12px] text-muted">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-primary-soft"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
