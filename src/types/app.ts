// App-level aliases over the generated Supabase types. Keep src/types/database.ts
// generated-only (npm run gen:types) and add hand-written helpers here.
import type { Enums, Tables } from './database';

export type AppRole = Enums<'app_role'>;
export type Profile = Tables<'profiles'>;
export type MetricUnit = Enums<'metric_unit'>;
export type CurrencyCode = Enums<'currency_code'>;
