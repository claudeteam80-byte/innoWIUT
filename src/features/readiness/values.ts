// What each readiness requirement shows as its current value. Everything is read from the
// existing records (startup profile, readiness profile, team, traction, evidence) — nothing
// is copied, and nothing is invented: a missing value is null.
import { formatMoney, formatNumber } from '@/domain/format';
import {
  COMMITMENTS,
  PRODUCT_STAGES,
  ROUND_TYPES,
  optionLabel,
  type ReadinessProfile,
  type ReadinessRequirement,
  type ReadinessStateRow,
} from '@/domain/readiness';
import type { StageEvidence } from '@/domain/journey';
import type { Tables } from '@/types/database';

type Startup = Pick<
  Tables<'startups'>,
  'name' | 'tagline' | 'industry' | 'founded_year' | 'website'
>;
type TeamMember = Pick<Tables<'team_members'>, 'id' | 'commitment' | 'relevant_experience'>;

export interface ReadinessContext {
  startup: Startup;
  profile: ReadinessProfile | null;
  requirements: readonly ReadinessRequirement[];
  evidence: readonly StageEvidence[];
  team: readonly TeamMember[];
  primaryMetricIds: readonly string[];
}

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 'Yes' : 'No';

const text = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

/** Evidence attached to a readiness requirement (newest first). */
export const readinessEvidenceFor = (requirementId: string, evidence: readonly StageEvidence[]) =>
  evidence
    .filter((e) => e.readiness_requirement_id === requirementId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

/** Journey evidence (from earlier stages) a founder can link instead of re-uploading. */
export const reusableEvidence = (evidence: readonly StageEvidence[]) =>
  evidence.filter((e) => e.stage !== 'investor_readiness' && !e.update_id);

/** The value shown for a requirement, or null when there is nothing yet. */
export function requirementValue(row: ReadinessStateRow, ctx: ReadinessContext): string | null {
  const { startup, profile: p } = ctx;
  const own = ctx.requirements.find((r) => r.id === row.requirement_id);
  switch (row.requirement_key) {
    case 'startup_name':
      return text(startup.name);
    case 'one_line_description':
      return text(startup.tagline);
    case 'industry':
      return text(startup.industry);
    case 'business_type':
      return p?.business_type ?? null;
    case 'founded_year':
      return startup.founded_year ? String(startup.founded_year) : null;
    case 'website':
      return text(startup.website) ?? own?.url ?? null;
    case 'current_product_stage':
      return optionLabel(PRODUCT_STAGES, p?.product_stage);
    case 'primary_investor_metrics': {
      const count = ctx.primaryMetricIds.length;
      return count ? `${count} metric${count === 1 ? '' : 's'} selected` : null;
    }
    case 'founder_experience':
      return text(p?.founder_experience);
    case 'founder_commitment':
      return optionLabel(COMMITMENTS, p?.founder_commitment);
    case 'team_details': {
      const total = ctx.team.length;
      if (!total) return 'No other team members on your profile';
      const done = ctx.team.filter((m) => m.commitment && text(m.relevant_experience)).length;
      return `${done} of ${total} team members complete`;
    }
    case 'fundraising_status':
      return yesNo(p?.is_fundraising);
    case 'round_type':
      return optionLabel(ROUND_TYPES, p?.round_type);
    case 'target_raise':
      return p?.target_raise != null && p.raise_currency
        ? formatMoney(p.target_raise, p.raise_currency)
        : null;
    case 'use_of_funds':
      return text(p?.use_of_funds);
    case 'runway':
      return p?.runway_months != null ? `${formatNumber(p.runway_months)} months` : null;
    case 'previous_funding':
      return text(p?.previous_funding);
    case 'round_outcome':
      return text(p?.round_outcome);
    case 'valuation':
      return p?.valuation != null && p.raise_currency
        ? formatMoney(p.valuation, p.raise_currency)
        : p?.valuation != null
          ? formatNumber(p.valuation)
          : null;
    case 'company_registered':
      return yesNo(p?.company_registered);
    case 'jurisdiction':
      return text(p?.jurisdiction);
    case 'legal_entity_name':
      return text(p?.legal_entity_name);
    case 'cap_table_prepared':
      return yesNo(p?.cap_table_prepared);
    case 'ip_ownership_clear':
      return yesNo(p?.ip_ownership_clear);
    case 'legal_blockers':
      return p?.has_legal_blockers == null
        ? null
        : p.has_legal_blockers
          ? (text(p.legal_blockers_note) ?? 'Yes')
          : 'None';
  }
  if (!own) return null;
  const linked = ctx.evidence.find((e) => e.id === own.linked_existing_evidence_id);
  const attached = readinessEvidenceFor(own.id, ctx.evidence).length;
  const parts = [
    text(own.text_value),
    own.url,
    linked ? `Linked: ${linked.label}` : null,
    attached ? `${attached} evidence ${attached === 1 ? 'item' : 'items'}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Where a derived requirement's value comes from (shown under the title). */
export function requirementSource(row: ReadinessStateRow): string | null {
  switch (row.section) {
    case 'company':
      return row.requirement_key === 'business_type' ? null : 'From your startup profile';
    case 'traction':
      return 'From your traction metrics';
  }
  if (row.requirement_key === 'team_details') return 'From your startup profile team';
  return null;
}
