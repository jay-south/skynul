import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true,
      retry: 2
    }
  }
})

export function QueryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export { queryClient }
