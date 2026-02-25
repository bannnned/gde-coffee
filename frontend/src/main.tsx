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

function syncViewportInsetsCSSVars() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const root = document.documentElement
  const vv = window.visualViewport
  const vh = vv ? Math.max(0, vv.height) : window.innerHeight
  const vw = vv ? Math.max(0, vv.width) : window.innerWidth
  const scaleRaw = vv?.scale ?? 1
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1
  const top = vv ? Math.max(0, vv.offsetTop) : 0
  const bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
  root.style.setProperty('--app-vh', `${Math.round(vh)}px`)
  root.style.setProperty('--app-vw', `${Math.round(vw)}px`)
  root.style.setProperty('--vv-scale', scale.toFixed(3))
  root.style.setProperty('--vv-offset-top', `${Math.round(top)}px`)
  root.style.setProperty('--vv-offset-bottom', `${Math.round(bottom)}px`)
}

function bindViewportInsetsSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  let raf = 0
  const scheduleSync = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = window.requestAnimationFrame(() => {
      raf = 0
      syncViewportInsetsCSSVars()
    })
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      scheduleSync()
    }
  }

  scheduleSync()
  window.addEventListener('resize', scheduleSync, { passive: true })
  window.addEventListener('orientationchange', scheduleSync)
  window.addEventListener('pageshow', scheduleSync)
  window.addEventListener('focus', scheduleSync)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.visualViewport?.addEventListener('resize', scheduleSync)
  window.visualViewport?.addEventListener('scroll', scheduleSync)
}

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

const splashMountedAt = performance.now()
const MIN_SPLASH_VISIBLE_MS = 2000

const hideSplash = () => {
  const elapsed = performance.now() - splashMountedAt
  const delay = Math.max(0, MIN_SPLASH_VISIBLE_MS - elapsed)

  window.setTimeout(() => {
    document.body.classList.add('app-loaded')
    const splash = document.getElementById('app-splash')
    if (splash) {
      window.setTimeout(() => splash.remove(), 620)
    }
  }, delay)
}

if (document.readyState === 'complete') {
  hideSplash()
} else {
  window.addEventListener('load', hideSplash, { once: true })
}

bindViewportInsetsSync()

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
