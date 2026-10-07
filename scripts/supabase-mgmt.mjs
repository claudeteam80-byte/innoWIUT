// Supabase Management API helpers for maintenance scripts (Node, never shipped to the browser).
//
// Auth: in the Claude Code cloud environment the egress proxy injects the
// Supabase access token for api.supabase.com, so no token is read here. Elsewhere,
// set SUPABASE_ACCESS_TOKEN in your shell (never in a VITE_ variable or a file in git).

export const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'pjltssnapnpzdwrpmvqn';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

function headers() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Runs SQL as the `postgres` role. Throws on SQL errors. */
export async function sql(query) {
  const response = await fetch(`${API}/database/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SQL failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

export async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...init.headers },
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}
