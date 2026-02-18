import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider, useComputedColorScheme, type MantineColorsTuple, type MantineThemeOverride } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import './index.css'
import {
  applyPalette,
  getStoredPalette,
  listPalettes,
  setStoredPalette,
  type PaletteName,
} from './theme/palettes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const emerald: MantineColorsTuple = [
  'var(--color-brand-accent-soft)',
  'var(--color-brand-accent-soft)',
  'var(--color-brand-accent-soft)',
  'var(--color-brand-accent)',
  'var(--color-brand-accent)',
  'var(--color-brand-accent)',
  'var(--color-brand-accent)',
  'var(--color-brand-accent-strong)',
  'var(--color-brand-accent-strong)',
  'var(--color-brand-accent-strong)',
];

const theme: MantineThemeOverride = {
  colors: { emerald },
  primaryColor: 'emerald',
  primaryShade: { light: 6, dark: 8 },
};

function PaletteSync() {
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })

  useEffect(() => {
    applyPalette(getStoredPalette(), computed)
  }, [computed])

  useEffect(() => {
    const api = {
      get: () => getStoredPalette(),
      list: () => listPalettes(),
      set: (name: PaletteName) => {
        setStoredPalette(name)
        applyPalette(name, computed)
      },
    }
    ;(window as Window & { gdeCoffeePalette?: typeof api }).gdeCoffeePalette = api
    return () => {
      delete (window as Window & { gdeCoffeePalette?: typeof api }).gdeCoffeePalette
    }
  }, [computed])

  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="auto" theme={theme}>
        <PaletteSync />
        <Notifications />
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

const hideSplash = () => {
  document.body.classList.add('app-loaded')
  const splash = document.getElementById('app-splash')
  if (splash) {
    window.setTimeout(() => splash.remove(), 400)
  }
}

if (document.readyState === 'complete') {
  hideSplash()
} else {
  window.addEventListener('load', hideSplash, { once: true })
}

if ('serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => registration.update())
        .catch(() => undefined)
    },
    { once: true },
  )
}
