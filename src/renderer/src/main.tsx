import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from './providers/query-provider'
import { router } from './router'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')

createRoot(rootElement).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </StrictMode>
)
