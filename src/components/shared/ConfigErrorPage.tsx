import { CenteredMessage } from './CenteredMessage';

/** Rendered instead of the app when required environment variables are missing. */
export function ConfigErrorPage({ problems }: { problems: string[] }) {
  return (
    <CenteredMessage title="innoWIUT is not configured">
      <p>The app is missing required settings:</p>
      <ul className="list-disc space-y-1 pl-5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p>Copy .env.example to .env.local (or set the variables in Vercel) and restart.</p>
    </CenteredMessage>
  );
}
