import { Plus, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';

export function TractionEmptyState({ onAddMetric }: { onAddMetric: () => void }) {
  return (
    <EmptyState
      icon={TrendingUp}
      title="No traction yet"
      description="Track the numbers that matter to your startup."
      action={
        <Button onClick={onAddMetric}>
          <Plus aria-hidden="true" /> Add Metric
        </Button>
      }
    />
  );
}
