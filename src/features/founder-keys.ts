export const founderKeys = {
  startup: (userId: string | undefined) => ['startup', userId] as const,
  metrics: (startupId: string) => ['traction-metrics', startupId] as const,
  entries: (startupId: string) => ['traction-entries', startupId] as const,
  updates: (startupId: string) => ['startup-updates', startupId] as const,
  team: (startupId: string) => ['team-members', startupId] as const,
  mentor: (startupId: string) => ['assigned-mentor', startupId] as const,
  notes: (startupId: string) => ['mentor-notes', startupId] as const,
  meetings: (startupId: string) => ['meeting-requests', startupId] as const,
  signedUrl: (path: string) => ['signed-url', path] as const,
  requirements: (startupId: string) => ['stage-requirements', startupId] as const,
  evidence: (startupId: string) => ['stage-evidence', startupId] as const,
  reviews: (startupId: string) => ['stage-reviews', startupId] as const,
  readiness: (startupId: string) => ['investor-readiness', startupId] as const,
  readinessState: (startupId: string) => ['investor-readiness', startupId, 'state'] as const,
  readinessRequirements: (startupId: string) =>
    ['investor-readiness', startupId, 'requirements'] as const,
  readinessProfile: (startupId: string) => ['investor-readiness', startupId, 'profile'] as const,
  readinessMetrics: (startupId: string) => ['investor-readiness', startupId, 'metrics'] as const,
  readinessInterview: (startupId: string) =>
    ['investor-readiness', startupId, 'interview'] as const,
};
