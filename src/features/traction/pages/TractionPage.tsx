import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useMyStartup } from '@/features/startup/hooks';
import { AddMetricDialog } from '../components/AddMetricDialog';
import { MetricCard } from '../components/MetricCard';
import { RecordTractionDialog } from '../components/RecordTractionDialog';
import { ChartSkeleton, MetricCardsSkeleton } from '../components/Skeletons';
import { TractionChart } from '../components/TractionChart';
import { TractionEmptyState } from '../components/TractionEmptyState';
import { TractionHistory } from '../components/TractionHistory';
import { useEntries, useMetrics } from '../hooks';

export function TractionPage() {
  const startup = useMyStartup();
  const startupId = startup.data?.id;
  const metrics = useMetrics(startupId);
  const entries = useEntries(startupId);
  const [adding, setAdding] = useState(false);
  const [recording, setRecording] = useState(false);

  const metricList = metrics.data ?? [];
  const failed = startup.isError || metrics.isError || entries.isError;
  const loading = startup.isPending || metrics.isPending || entries.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Traction"
        title="Traction"
        subtitle="Track the numbers that matter to your startup."
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding(true)} disabled={!startupId}>
              <Plus aria-hidden="true" /> Add Metric
            </Button>
            <Button
              onClick={() => setRecording(true)}
              disabled={!startupId || metricList.length === 0}
            >
              <RefreshCw aria-hidden="true" /> Update Metrics
            </Button>
          </>
        }
      />

      {failed ? (
        <ErrorState
          description="We couldn't load your traction. Check your connection and try again."
          onRetry={() => {
            void startup.refetch();
            void metrics.refetch();
            void entries.refetch();
          }}
        />
      ) : loading ? (
        <>
          <MetricCardsSkeleton />
          <ChartSkeleton />
        </>
      ) : metricList.length === 0 ? (
        <TractionEmptyState onAddMetric={() => setAdding(true)} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricList.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
          <Card>
            <CardHeader title="Trend" description="Built from your recorded traction history." />
            <TractionChart metrics={metricList} entries={entries.data ?? []} />
          </Card>
          <Card>
            <CardHeader
              title="Traction history"
              description="Every value you have recorded, newest first."
            />
            {(entries.data ?? []).length === 0 ? (
              <p className="text-[13px] text-muted">No values recorded yet.</p>
            ) : (
              <TractionHistory entries={entries.data ?? []} metrics={metricList} />
            )}
          </Card>
        </>
      )}

      {startupId && (
        <>
          <AddMetricDialog
            open={adding}
            onOpenChange={setAdding}
            startupId={startupId}
            existingNames={metricList.map((m) => m.name)}
          />
          <RecordTractionDialog
            open={recording}
            onOpenChange={setRecording}
            startupId={startupId}
            metrics={metricList}
          />
        </>
      )}
    </div>
  );
}
