export function initials(value: string | null | undefined): string {
  const letters = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return letters || '?';
}

export function firstName(value: string | null | undefined): string | null {
  const first = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  return first ?? null;
}
