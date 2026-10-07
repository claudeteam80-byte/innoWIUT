import { Suspense, useState } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { FullPageSpinner } from '@/components/shared/FullPageSpinner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient } from '@/lib/query-client';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export default function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<FullPageSpinner />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </QueryClientProvider>
  );
}
