// Option lists shared by forms and the database check constraints.
export const INDUSTRIES = [
  'AI',
  'EdTech',
  'FinTech',
  'SaaS',
  'E-commerce',
  'HealthTech',
  'Marketplace',
  'Other',
] as const;
export const STAGES = ['Idea', 'Validation', 'MVP', 'Early Traction', 'Growth'] as const;
export const FOUNDER_ROLES = ['Founder', 'Co-Founder', 'CEO', 'CTO', 'Other'] as const;
export const MEETING_REASONS = [
  'Product',
  'Growth',
  'Business Model',
  'Fundraising',
  'Team',
  'Other',
] as const;
export const CURRENCIES = ['USD', 'UZS'] as const;
export const METRIC_UNITS = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percentage (%)' },
] as const;

export const METRIC_PRESETS = [
  { name: 'Active Users', unit: 'number' },
  { name: 'Registered Users', unit: 'number' },
  { name: 'Revenue', unit: 'currency' },
  { name: 'MRR', unit: 'currency' },
  { name: 'Customers', unit: 'number' },
  { name: 'Pilots', unit: 'number' },
  { name: 'Partnerships', unit: 'number' },
  { name: 'Transactions', unit: 'number' },
  { name: 'Waitlist', unit: 'number' },
  { name: 'Retention', unit: 'percent' },
  { name: 'Conversion', unit: 'percent' },
] as const;

export const CUSTOM_METRIC = '__custom__';
