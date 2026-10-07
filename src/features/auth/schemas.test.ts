import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  founderSignUpSchema,
  resetPasswordSchema,
  signInSchema,
  verificationCodeSchema,
} from './schemas';

function messages(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  );
}

const validSignUp = {
  fullName: '  Yodgor Karimov ',
  email: '  Founder@WIUT.uz ',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
  acceptTerms: true,
};

describe('signInSchema', () => {
  it('normalises the email', () => {
    expect(signInSchema.parse({ email: ' You@Example.COM ', password: 'x' })).toEqual({
      email: 'you@example.com',
      password: 'x',
    });
  });

  it('rejects missing and malformed values', () => {
    expect(messages(signInSchema.safeParse({ email: '', password: '' }))).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(messages(signInSchema.safeParse({ email: 'not-an-email', password: 'x' }))).toEqual({
      email: 'Enter a valid email address.',
    });
  });
});

describe('founderSignUpSchema', () => {
  it('accepts and trims a valid sign up', () => {
    expect(founderSignUpSchema.parse(validSignUp)).toMatchObject({
      fullName: 'Yodgor Karimov',
      email: 'founder@wiut.uz',
    });
  });

  it('requires matching passwords', () => {
    const result = founderSignUpSchema.safeParse({ ...validSignUp, confirmPassword: 'different' });
    expect(messages(result)).toEqual({ confirmPassword: 'Passwords do not match.' });
  });

  it('enforces password length', () => {
    const short = founderSignUpSchema.safeParse({
      ...validSignUp,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(messages(short).password).toBe('Use at least 8 characters.');
    const long = 'a'.repeat(73);
    const tooLong = founderSignUpSchema.safeParse({
      ...validSignUp,
      password: long,
      confirmPassword: long,
    });
    expect(messages(tooLong).password).toBe('Use 72 characters or fewer.');
  });

  it('requires agreeing to the terms', () => {
    const result = founderSignUpSchema.safeParse({ ...validSignUp, acceptTerms: false });
    expect(messages(result)).toEqual({
      acceptTerms: 'Please agree to the Terms and Privacy Policy to continue.',
    });
  });

  it('requires a name', () => {
    expect(
      messages(founderSignUpSchema.safeParse({ ...validSignUp, fullName: ' ' })).fullName,
    ).toBe('Enter your full name.');
  });
});

describe('verificationCodeSchema', () => {
  it('accepts six digits, ignoring spaces', () => {
    expect(verificationCodeSchema.parse({ code: '123 456' })).toEqual({ code: '123456' });
  });

  it.each(['12345', '1234567', 'abcdef', ''])('rejects %j', (code) => {
    expect(messages(verificationCodeSchema.safeParse({ code })).code).toBe(
      'Enter the 6-digit code from your email.',
    );
  });
});

describe('forgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(forgotPasswordSchema.parse({ email: 'A@B.co' })).toEqual({ email: 'a@b.co' });
  });
});

describe('resetPasswordSchema', () => {
  it('requires a strong matching password', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'new-password', confirmPassword: 'new-password' })
        .success,
    ).toBe(true);
    expect(
      messages(
        resetPasswordSchema.safeParse({ password: 'new-password', confirmPassword: 'other' }),
      ),
    ).toEqual({
      confirmPassword: 'Passwords do not match.',
    });
  });
});
