import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label={`${label} pages`}
      className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted"
    >
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
