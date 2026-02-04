import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const theme = {
  colors: {
    emerald: [
      '#f2f8f6',
      '#d7e9e4',
      '#b8d8d1',
      '#93c1b7',
      '#6ea99e',
      '#4f8c81',
      '#457E73',
      '#3a6c62',
      '#2f5a52',
      '#244844',
    ],
  },
  primaryColor: 'emerald',
  primaryShade: { light: 6, dark: 5 },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="auto" theme={theme}>
        <Notifications />
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
