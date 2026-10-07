/** Flattens a Zod safeParse result into { "path.to.field": "first message" }. */
export function issues(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.map(String).join('.');
    out[key] ??= issue.message;
  }
  return out;
}
