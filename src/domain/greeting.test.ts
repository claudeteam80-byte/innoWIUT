import { describe, expect, it } from 'vitest';
import { greetingFor } from './greeting';

describe('greetingFor', () => {
  it.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('%i:00 → %s', (hour, greeting) => {
    expect(greetingFor(new Date(2026, 9, 8, hour, 30))).toBe(greeting);
  });
});
