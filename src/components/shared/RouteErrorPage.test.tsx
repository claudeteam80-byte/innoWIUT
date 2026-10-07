import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError } from '@/lib/chunk-reload';
import { APP_TITLE } from '@/lib/document-title';
import { routes } from '@/app/routes';
import { RouteErrorPage } from './RouteErrorPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

function Boom({ error }: { error: Error }): never {
  throw error;
}

function renderFailing(error: Error) {
  const router = createMemoryRouter([
    { path: '/', element: <Boom error={error} />, errorElement: <RouteErrorPage /> },
  ]);
  render(<RouterProvider router={router} />);
}

describe('RouteErrorPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('shows a friendly message instead of a blank screen when a page crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderFailing(new Error('render failed'));
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to start' })).toHaveAttribute('href', '/');
    expect(document.title).toBe(`Something went wrong · ${APP_TITLE}`);
  });

  it('explains a stale deploy and reloads once', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    renderFailing(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'));
    expect(screen.getByRole('heading', { name: 'A new version is available' })).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('every page is wrapped by the error boundary', () => {
    expect(routes).toHaveLength(1);
    expect(routes[0]!.errorElement).toBeTruthy();
  });
});

describe('isChunkLoadError', () => {
  it('recognises missing-chunk errors from Chrome, Firefox and Safari', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: x'))).toBe(
      true,
    );
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
