import { describe, expect, it } from 'vitest';
import {
  JOURNEY_STAGES,
  TRACTION_OPTIONS,
  journeySummary,
  metricMovement,
  nextAction,
  stagePosition,
  stageProgress,
  stageRequirements,
  suggestedMetric,
  type StageKey,
  type StageRequirement,
} from './journey';

let seq = 0;
function req(
  stage: StageKey,
  requirement_key: string,
  overrides: Partial<StageRequirement> = {},
): StageRequirement {
  seq += 1;
  return {
    id: `r${seq}`,
    startup_id: 's1',
    stage,
    requirement_key,
    title: requirement_key,
    description: null,
    required: true,
    status: 'not_started',
    progress_value: null,
    progress_target: null,
    linked_metric_id: null,
    completed_at: null,
    created_at: `2026-10-0${(seq % 9) + 1}T00:00:00Z`,
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const templateRows = (stage: StageKey, overrides: Record<string, Partial<StageRequirement>> = {}) =>
  JOURNEY_STAGES.find((s) => s.key === stage)!.requirements.map((t) =>
    req(stage, t.key, {
      title: t.title,
      progress_target: t.target ?? null,
      ...overrides[t.key],
    }),
  );

describe('stages', () => {
  it('has six stages with the two investor stages locked', () => {
    expect(JOURNEY_STAGES.map((s) => s.key)).toEqual([
      'idea',
      'validation',
      'mvp',
      'traction',
      'investor_readiness',
      'investor_access',
    ]);
    expect(JOURNEY_STAGES.filter((s) => s.locked).map((s) => s.key)).toEqual([
      'investor_readiness',
      'investor_access',
    ]);
  });

  it('matches the database templates (5 / 6 / 6, traction chosen by the founder)', () => {
    const counts = Object.fromEntries(JOURNEY_STAGES.map((s) => [s.key, s.requirements.length]));
    expect(counts).toMatchObject({ idea: 5, validation: 6, mvp: 6, traction: 0 });
    expect(TRACTION_OPTIONS.map((o) => o.key)).toEqual([
      'active_users',
      'revenue',
      'mrr',
      'pilots',
      'retention',
      'conversion',
      'transactions',
      'partnerships',
      'lois',
      'waitlist',
    ]);
  });

  it('positions stages around the current one and keeps investor stages locked', () => {
    expect(stagePosition('idea', 'mvp')).toBe('completed');
    expect(stagePosition('mvp', 'mvp')).toBe('current');
    expect(stagePosition('traction', 'mvp')).toBe('upcoming');
    expect(stagePosition('investor_readiness', 'traction')).toBe('locked');
    expect(stagePosition('investor_access', 'idea')).toBe('locked');
  });
});

describe('stageProgress', () => {
  it('orders rows by template and counts completed required requirements', () => {
    const rows = templateRows('idea', {
      solution: { status: 'completed' },
      problem_statement: { status: 'ready_for_review' },
    }).reverse();
    const progress = stageProgress('idea', rows);
    expect(progress.rows.map((r) => r.requirement_key)).toEqual([
      'problem_statement',
      'target_customer',
      'solution',
      'founder_team',
      'market_hypothesis',
    ]);
    expect(progress).toMatchObject({ total: 5, completed: 1, percent: 20, isComplete: false });
  });

  it('only counts the requested stage', () => {
    const rows = [...templateRows('idea'), ...templateRows('validation')];
    expect(stageProgress('validation', rows).total).toBe(6);
  });

  it('reports a complete stage without changing anything else', () => {
    const rows = templateRows(
      'mvp',
      Object.fromEntries(
        JOURNEY_STAGES[2]!.requirements.map((t) => [t.key, { status: 'completed' as const }]),
      ),
    );
    const before = JSON.stringify(rows);
    const progress = stageProgress('mvp', rows);
    expect(progress).toMatchObject({ completed: 6, total: 6, percent: 100, isComplete: true });
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('treats an empty traction stage as not complete', () => {
    expect(stageProgress('traction', [])).toMatchObject({
      total: 0,
      percent: 0,
      isComplete: false,
    });
  });

  it('keeps traction rows in the order the founder chose them', () => {
    const rows = [
      req('traction', 'revenue', { created_at: '2026-10-02T00:00:00Z' }),
      req('traction', 'pilots', { created_at: '2026-10-01T00:00:00Z' }),
    ];
    expect(stageRequirements('traction', rows).map((r) => r.requirement_key)).toEqual([
      'pilots',
      'revenue',
    ]);
  });
});

describe('nextAction (deterministic)', () => {
  it('points at the first unfinished requirement in template order', () => {
    const rows = templateRows('idea', { problem_statement: { status: 'completed' } });
    expect(nextAction('idea', rows)).toMatchObject({
      kind: 'complete_requirement',
      title: 'Complete "Target Customer"',
      requirementId: rows[1]!.id,
    });
  });

  it('counts down a target', () => {
    const rows = templateRows('validation', { customer_interviews: { progress_value: 7 } });
    expect(nextAction('validation', rows).title).toBe('Complete 3 more customer interviews');
  });

  it('asks to complete a requirement whose target is already met', () => {
    const rows = templateRows('validation', { customer_interviews: { progress_value: 12 } });
    expect(nextAction('validation', rows)).toMatchObject({
      kind: 'complete_requirement',
      title: 'Complete "Customer Interviews"',
    });
  });

  it('gives the same answer for the same input', () => {
    const rows = templateRows('mvp', { working_mvp: { status: 'completed' } });
    expect(nextAction('mvp', rows)).toEqual(nextAction('mvp', [...rows].reverse()));
  });

  it('says the stage is complete but never moves the stage', () => {
    const rows = templateRows(
      'idea',
      Object.fromEntries(
        JOURNEY_STAGES[0]!.requirements.map((t) => [t.key, { status: 'completed' as const }]),
      ),
    );
    const summary = journeySummary('idea', rows);
    expect(summary.next.kind).toBe('stage_complete');
    expect(summary.isComplete).toBe(true);
    expect(summary.stage.key).toBe('idea');
  });

  it('walks the traction steps: choose → link → record → complete', () => {
    expect(nextAction('traction', []).kind).toBe('choose_metrics');
    const unlinked = [req('traction', 'active_users', { title: 'Active Users' })];
    expect(nextAction('traction', unlinked)).toMatchObject({
      kind: 'link_metric',
      title: 'Link Active Users to a traction metric',
    });
    const metric = {
      id: 'm1',
      name: 'Active Users',
      current_value: null,
      last_recorded_on: null,
      is_archived: false,
    };
    const linked = [{ ...unlinked[0]!, linked_metric_id: 'm1' }];
    expect(nextAction('traction', linked, [metric]).kind).toBe('record_metric');
    expect(nextAction('traction', linked, [{ ...metric, current_value: 120 }]).kind).toBe(
      'complete_requirement',
    );
  });

  it('never offers actions for locked stages', () => {
    expect(nextAction('investor_readiness', []).kind).toBe('locked');
    expect(nextAction('investor_access', []).kind).toBe('locked');
  });
});

describe('traction links', () => {
  it('suggests the founder’s existing metric by name', () => {
    const metrics = [
      { id: 'a', name: 'Monthly Revenue', is_archived: false },
      { id: 'b', name: 'Active Users', is_archived: true },
    ];
    expect(suggestedMetric('revenue', metrics)?.id).toBe('a');
    expect(suggestedMetric('active_users', metrics)).toBeNull();
  });

  it('reads previous → current from the raw history', () => {
    const entries = [
      { metric_id: 'm', value: 100, recorded_on: '2026-09-01', created_at: '2026-09-01T10:00:00Z' },
      { metric_id: 'm', value: 150, recorded_on: '2026-09-08', created_at: '2026-09-08T10:00:00Z' },
      { metric_id: 'm', value: 180, recorded_on: '2026-09-15', created_at: '2026-09-15T10:00:00Z' },
      {
        metric_id: 'other',
        value: 9,
        recorded_on: '2026-09-20',
        created_at: '2026-09-20T10:00:00Z',
      },
    ];
    expect(metricMovement(entries, 'm')).toEqual({
      previous: 150,
      current: 180,
      changePercent: 20,
    });
    expect(metricMovement(entries, 'm', '2026-09-10')).toEqual({
      previous: 100,
      current: 150,
      changePercent: 50,
    });
    expect(metricMovement(entries, 'm', '2026-08-01')).toEqual({
      previous: null,
      current: null,
      changePercent: null,
    });
  });

  it('cannot compute a change from zero', () => {
    const entries = [
      { metric_id: 'm', value: 0, recorded_on: '2026-09-01', created_at: '2026-09-01T00:00:00Z' },
      { metric_id: 'm', value: 5, recorded_on: '2026-09-02', created_at: '2026-09-02T00:00:00Z' },
    ];
    expect(metricMovement(entries, 'm').changePercent).toBeNull();
  });
});
