import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigErrorPage } from '@/components/shared/ConfigErrorPage';
import { FullPageSpinner } from '@/components/shared/FullPageSpinner';
import { reloadOnceForNewVersion } from '@/lib/chunk-reload';
import { parseEnv } from '@/lib/env';
import './index.css';

// A file from an older deploy is gone: reload once to pick up the new version.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});

const root = createRoot(document.getElementById('root') as HTMLElement);
const env = parseEnv(import.meta.env);

if (!env.ok) {
  root.render(
    <StrictMode>
      <ConfigErrorPage problems={env.problems} />
    </StrictMode>,
  );
} else {
  // Loaded lazily so the Supabase client is only created with a valid config.
  const App = lazy(() => import('./app/App'));
  root.render(
    <StrictMode>
      <Suspense fallback={<FullPageSpinner />}>
        <App />
      </Suspense>
    </StrictMode>,
  );
}
