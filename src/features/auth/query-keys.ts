export const authKeys = {
  profile: (userId: string | undefined) => ['profile', userId] as const,
};
