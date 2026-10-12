import { CalendarClock, CheckCircle2, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { formatDate } from '@/domain/dates';
import { formatMetricValue, formatMoney } from '@/domain/format';
import {
  PRODUCT_STAGES,
  ROUND_TYPES,
  optionLabel,
  type ReadinessInterview,
  type SectionProgress,
} from '@/domain/readiness';
import type { Metric } from '@/features/traction/api';
import { cn } from '@/lib/cn';
import { INTERVIEW_STATUS, formatDateTime } from '../ui-helpers';
import type { ReadinessContext } from '../values';

export function LocationValue({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  return /^https?:\/\//i.test(value) ? (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium break-all text-primary hover:underline"
    >
      {value}
    </a>
  ) : (
    <>{value}</>
  );
}

/** Read-only for founders: date, time, location and status set by innoWIUT. */
export function InterviewCard({ interview }: { interview: ReadinessInterview | null }) {
  if (!interview || interview.status === 'not_required') return null;
  const meta = INTERVIEW_STATUS[interview.status];
  return (
    <section
      aria-labelledby="readiness-interview-title"
      className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="readiness-interview-title"
              className="text-[10.5px] font-semibold tracking-[0.16em] text-muted uppercase"
            >
              Readiness interview
            </h2>
            <p className="mt-1.5 text-[15px] font-semibold text-ink">
              {interview.status === 'scheduled'
                ? 'innoWIUT scheduled an interview with you'
                : 'Your interview with innoWIUT is complete'}
            </p>
          </div>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-[11.5px] font-medium text-muted">Date & time</dt>
          <dd className="mt-0.5 text-ink">{formatDateTime(interview.scheduled_at)}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] font-medium text-muted">Location or link</dt>
          <dd className="mt-0.5 text-ink">
            <LocationValue value={interview.location_or_link} />
          </dd>
        </div>
        {interview.completed_at && (
          <div>
            <dt className="text-[11.5px] font-medium text-muted">Completed</dt>
            <dd className="mt-0.5 text-ink">{formatDate(interview.completed_at, 'long')}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** Nine compact section tiles; each jumps to its section. */
export function SectionProgressGrid({ sections }: { sections: readonly SectionProgress[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Readiness sections">
      {sections.map((section) => (
        <li key={section.key}>
          <a
            href={`#readiness-${section.key}`}
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById(`readiness-${section.key}`)
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="block h-full rounded-xl border border-line bg-white px-3.5 py-3 transition hover:border-primary/50"
            aria-label={`${section.name}: ${section.completed} of ${section.total} complete`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] leading-tight font-semibold text-ink">{section.name}</p>
              {section.status === 'complete' && (
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success text-white">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              {section.completed} of {section.total} complete
            </p>
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-primary-soft"
              aria-hidden="true"
            >
              <div
                className={cn('h-full rounded-full bg-success transition-[width]')}
                style={{ width: `${section.percent}%` }}
              />
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** A plain summary built only from real data; items without data are left out. */
export function ReadinessSummaryCard({
  context,
  metrics,
}: {
  context: ReadinessContext;
  metrics: readonly Metric[];
}) {
  const { startup, profile: p, team, primaryMetricIds } = context;
  const primary = primaryMetricIds
    .map((id) => metrics.find((m) => m.id === id))
    .filter((m): m is Metric => Boolean(m) && m!.current_value !== null);
  const items: { label: string; value: string }[] = [
    { label: 'Startup', value: [startup.name, startup.tagline].filter(Boolean).join(' — ') },
    { label: 'Industry', value: [startup.industry, p?.business_type].filter(Boolean).join(' · ') },
    { label: 'Product stage', value: optionLabel(PRODUCT_STAGES, p?.product_stage) ?? '' },
    {
      label: 'Primary metrics',
      value: primary
        .map((m) => `${m.name}: ${formatMetricValue(m.current_value, m.unit, m.currency)}`)
        .join(' · '),
    },
    {
      label: 'Raising',
      value:
        p?.is_fundraising === false
          ? 'Not raising right now'
          : [
              optionLabel(ROUND_TYPES, p?.round_type),
              p?.target_raise != null && p.raise_currency
                ? formatMoney(p.target_raise, p.raise_currency)
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
    },
    {
      label: 'Runway',
      value: p?.runway_months != null ? `${p.runway_months} months` : '',
    },
    {
      label: 'Team',
      value: team.length
        ? `${team.length} team ${team.length === 1 ? 'member' : 'members'} listed`
        : '',
    },
  ].filter((item) => item.value);

  return (
    <Card>
      <CardHeader
        title="Readiness summary"
        description="What an investor would see first — from your own data."
      />
      <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[11.5px] font-medium text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Investor Access after an approved readiness review. Nothing investor-facing exists yet. */
export function InvestorAccessCard({ approvedAt }: { approvedAt?: string | null }) {
  return (
    <section
      aria-labelledby="investor-access-title"
      className="rounded-xl border border-success/30 bg-white p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold tracking-[0.16em] text-success uppercase">
              Unlocked
            </p>
            <h2 id="investor-access-title" className="mt-1.5 text-[15px] font-semibold text-ink">
              Investor Access
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Investor introductions will be available in the next stage.
            </p>
            {approvedAt && (
              <p className="mt-1 text-[12px] text-muted">
                Investor Ready since {formatDate(approvedAt, 'long')}
              </p>
            )}
          </div>
        </div>
        <Badge tone="positive">Investor Ready</Badge>
      </div>
      <Button className="mt-4" disabled>
        Coming Soon
      </Button>
    </section>
  );
}
