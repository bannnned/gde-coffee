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

<<<<<<< HEAD
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
=======
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
>>>>>>> 7ff19c2 (уберет classname и поправит подписи)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="auto" theme={theme}>
<<<<<<< HEAD
        <PaletteSync />
=======
>>>>>>> 7ff19c2 (уберет classname и поправит подписи)
        <Notifications />
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
<<<<<<< HEAD

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
=======
>>>>>>> 7ff19c2 (уберет classname и поправит подписи)
