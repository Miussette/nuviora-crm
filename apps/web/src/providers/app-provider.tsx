'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } }));
  return <QueryClientProvider client={client}>{children}<Toaster richColors position="bottom-right" /></QueryClientProvider>;
}
