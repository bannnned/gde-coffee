import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import { AppNotifications } from './lib/notifications'
import useAppColorScheme, { AppColorSchemeProvider } from './hooks/useAppColorScheme'
import { AppHapticsProvider } from './hooks/useAppHaptics'
import { appHaptics } from './lib/haptics'
import {
  applyPalette,
  getStoredPalette,
  listPalettes,
  setStoredPalette,
  type PaletteName,
} from './theme/palettes'
import { SPLASH_REEL_ITEMS, type SplashPhraseItem } from './config/splashPhrases'

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

const CHUNK_RELOAD_STORAGE_KEY = "gdeCoffeeChunkReloaded"
let mapChunkPrefetchStarted = false
let mapStyleWarmupStarted = false
const insertedMapHintKeys = new Set<string>()
const DEFAULT_MAP_STYLE_LIGHT_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
const DEFAULT_MAP_STYLE_DARK_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
const MAP_STYLE_URL_RAW = (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim() ?? ""
const MAP_STYLE_LIGHT_URL_RAW =
  (import.meta.env.VITE_MAP_STYLE_URL_LIGHT as string | undefined)?.trim() ||
  MAP_STYLE_URL_RAW ||
  DEFAULT_MAP_STYLE_LIGHT_URL
const MAP_STYLE_DARK_URL_RAW =
  (import.meta.env.VITE_MAP_STYLE_URL_DARK as string | undefined)?.trim() ||
  MAP_STYLE_URL_RAW ||
  DEFAULT_MAP_STYLE_DARK_URL
const FALLBACK_TILE_ORIGINS = [
  "https://a.tile.openstreetmap.org",
  "https://b.tile.openstreetmap.org",
  "https://c.tile.openstreetmap.org",
] as const

function readErrorMessage(reason: unknown): string {
  if (typeof reason === "string") return reason
  if (reason instanceof Error) return reason.message
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return ""
}

function isChunkLoadLikeError(reason: unknown): boolean {
  const message = readErrorMessage(reason).toLowerCase()
  if (!message) return false
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("module script") ||
    message.includes("mime type")
  )
}

function triggerChunkRecoveryReload(): boolean {
  if (typeof window === "undefined") return false
  try {
    const alreadyReloaded = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === "1"
    if (alreadyReloaded) return false
    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, "1")
  } catch {
    // Ignore storage issues and still try a hard refresh.
  }
  window.location.reload()
  return true
}

function bindChunkLoadRecovery() {
  if (typeof window === "undefined") return

  const handleVitePreloadError = (event: Event) => {
    const payloadEvent = event as Event & { payload?: unknown; detail?: unknown }
    const reason = payloadEvent.payload ?? payloadEvent.detail
    if (!isChunkLoadLikeError(reason)) return
    if (triggerChunkRecoveryReload() && "preventDefault" in payloadEvent) {
      payloadEvent.preventDefault()
    }
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!isChunkLoadLikeError(event.reason)) return
    if (triggerChunkRecoveryReload()) {
      event.preventDefault()
    }
  }

  window.addEventListener("vite:preloadError", handleVitePreloadError as EventListener)
  window.addEventListener("unhandledrejection", handleUnhandledRejection)
}

function normalizeMapStyleUrl(raw: string): string {
  return /tiles\.openfreemap\.org/i.test(raw) ? "" : raw
}

function extractUrlOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function shouldPrefetchMapChunk(): boolean {
  if (import.meta.env.MODE === "test") return false
  if (typeof navigator === "undefined") return false
  if (window.location.pathname !== "/") return false
  const connection = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean
        effectiveType?: string
      }
    }
  ).connection
  if (connection?.saveData) return false
  const effectiveType = connection?.effectiveType?.toLowerCase() ?? ""
  if (effectiveType.includes("2g")) return false
  return true
}

function collectMapHintOrigins(): string[] {
  const origins = new Set<string>()
  const styleCandidates = [
    normalizeMapStyleUrl(MAP_STYLE_LIGHT_URL_RAW),
    normalizeMapStyleUrl(MAP_STYLE_DARK_URL_RAW),
  ].filter(Boolean)
  for (const styleUrl of styleCandidates) {
    const origin = extractUrlOrigin(styleUrl)
    if (origin) origins.add(origin)
  }
  for (const fallbackOrigin of FALLBACK_TILE_ORIGINS) {
    origins.add(fallbackOrigin)
  }
  return Array.from(origins)
}

function appendMapHintLink(rel: "dns-prefetch" | "preconnect" | "prefetch", href: string, as?: "fetch") {
  if (!href) return
  const key = `${rel}:${href}:${as ?? ""}`
  if (insertedMapHintKeys.has(key)) return
  insertedMapHintKeys.add(key)

  const link = document.createElement("link")
  link.rel = rel
  link.href = href
  if (rel === "preconnect") link.crossOrigin = "anonymous"
  if (rel === "prefetch" && as) {
    link.as = as
    link.crossOrigin = "anonymous"
  }
  document.head.appendChild(link)
}

function resolveMapStyleWarmupUrl(): string {
  const lightStyle = normalizeMapStyleUrl(MAP_STYLE_LIGHT_URL_RAW)
  const darkStyle = normalizeMapStyleUrl(MAP_STYLE_DARK_URL_RAW)
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  if (prefersDark) return darkStyle || lightStyle
  return lightStyle || darkStyle
}

function installMapNetworkHints() {
  if (typeof document === "undefined") return
  if (!shouldPrefetchMapChunk()) return

  const hintOrigins = collectMapHintOrigins()
  for (const origin of hintOrigins) {
    appendMapHintLink("dns-prefetch", origin)
    appendMapHintLink("preconnect", origin)
  }

  const styleWarmupUrl = resolveMapStyleWarmupUrl()
  if (styleWarmupUrl) {
    appendMapHintLink("prefetch", styleWarmupUrl, "fetch")
  }
}

function prefetchMapChunk() {
  if (mapChunkPrefetchStarted) return
  mapChunkPrefetchStarted = true
  void import("./components/Map").catch(() => undefined)
}

function scheduleMapChunkPrefetch() {
  if (typeof window === "undefined") return
  if (!shouldPrefetchMapChunk()) return

  const runPrefetch = () => prefetchMapChunk()
  const requestIdle = window.requestIdleCallback

  window.requestAnimationFrame(() => {
    if (typeof requestIdle === "function") {
      requestIdle(runPrefetch, { timeout: 1200 })
      return
    }
    window.setTimeout(runPrefetch, 450)
  })
}

function warmupMapStyleRequest() {
  if (mapStyleWarmupStarted) return
  if (typeof window === "undefined") return
  if (!shouldPrefetchMapChunk()) return

  const styleWarmupUrl = resolveMapStyleWarmupUrl()
  if (!styleWarmupUrl) return
  mapStyleWarmupStarted = true

  const runWarmup = () => {
    void fetch(styleWarmupUrl, {
      mode: "no-cors",
      credentials: "omit",
      cache: "force-cache",
    }).catch(() => undefined)
  }

  const requestIdle = window.requestIdleCallback
  if (typeof requestIdle === "function") {
    requestIdle(runWarmup, { timeout: 1600 })
    return
  }
  window.setTimeout(runWarmup, 650)
}

function PaletteSync() {
  const { colorScheme } = useAppColorScheme()

  useEffect(() => {
    applyPalette(getStoredPalette(), colorScheme)
  }, [colorScheme])

  useEffect(() => {
    const api = {
      get: () => getStoredPalette(),
      list: () => listPalettes(),
      set: (name: PaletteName) => {
        setStoredPalette(name)
        applyPalette(name, colorScheme)
      },
    }
    ;(window as Window & { gdeCoffeePalette?: typeof api }).gdeCoffeePalette = api
    return () => {
      delete (window as Window & { gdeCoffeePalette?: typeof api }).gdeCoffeePalette
    }
  }, [colorScheme])

  return null
}

type QueryDevtoolsComponent = React.ComponentType<{ initialIsOpen?: boolean }>

function QueryDevtoolsSlot() {
  const [Devtools, setDevtools] = useState<QueryDevtoolsComponent | null>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let isMounted = true
    void import('@tanstack/react-query-devtools')
      .then((module) => {
        if (!isMounted) return
        setDevtools(() => module.ReactQueryDevtools)
      })
      .catch(() => undefined)
    return () => {
      isMounted = false
    }
  }, [])

  if (!import.meta.env.DEV || !Devtools) return null
  return <Devtools initialIsOpen={false} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppColorSchemeProvider>
        <AppHapticsProvider>
          <PaletteSync />
          <AppNotifications />
          <App />
          <QueryDevtoolsSlot />
        </AppHapticsProvider>
      </AppColorSchemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

const SPLASH_REEL_START_DELAY_MS = 520
const SPLASH_REEL_STEP_INTERVAL_MS = 620
const SPLASH_REEL_TRANSITION_MS = 420

const splashMountedAt = performance.now()
const MIN_SPLASH_VISIBLE_MS = Math.min(
  4200,
  2200 + Math.max(0, SPLASH_REEL_ITEMS.length - 1) * SPLASH_REEL_STEP_INTERVAL_MS,
)
const SPLASH_FADE_FALLBACK_MS = 900
const SPLASH_QUESTION_ANIMATION = 'splash-question-jiggle'

function bindSplashHaptics() {
  if (typeof document === 'undefined') return
  const splashQuestion = document.querySelector('.splash-question')
  if (!splashQuestion) return

  const handleQuestionAnimationStart = (event: Event) => {
    const animationEvent = event as AnimationEvent
    if (animationEvent.animationName !== SPLASH_QUESTION_ANIMATION) return
    void appHaptics.trigger('soft')
  }

  splashQuestion.addEventListener('animationstart', handleQuestionAnimationStart, { once: true })
}

function bindSplashPhraseReel() {
  if (typeof document === 'undefined') return
  const lockup = document.querySelector<HTMLElement>('.splash-lockup')
  const roller = document.querySelector<HTMLElement>('.splash-roller')
  const current = roller?.querySelector<HTMLElement>('.splash-phrase.is-current') ?? null
  const next = roller?.querySelector<HTMLElement>('.splash-phrase.is-next') ?? null
  const prefix = document.querySelector<HTMLElement>('.splash-prefix')
  if (!lockup || !roller || !current || !next || !prefix) return
  if (SPLASH_REEL_ITEMS.length <= 1) return

  let stepIndex = 0
  let stepTimer = 0
  let transitionTimer = 0
  let activeItem = SPLASH_REEL_ITEMS[0]!
  let adaptiveBasePx = 0

  const sizer = document.createElement('span')
  sizer.style.position = 'absolute'
  sizer.style.visibility = 'hidden'
  sizer.style.pointerEvents = 'none'
  sizer.style.whiteSpace = 'nowrap'
  sizer.style.left = '-9999px'
  sizer.style.top = '-9999px'
  sizer.style.fontFamily = 'var(--font-display)'
  sizer.style.fontWeight = '700'
  sizer.style.lineHeight = '1'
  document.body.appendChild(sizer)

  const parseSizeMultiplier = (size?: string) => {
    if (!size) return 1
    const numeric = Number.parseFloat(size)
    if (!Number.isFinite(numeric) || numeric <= 0) return 1
    return numeric
  }

  const textWidth = (text: string, fontSizePx: number) => {
    sizer.textContent = text
    sizer.style.fontSize = `${fontSizePx}px`
    return Math.max(1, Math.ceil(sizer.getBoundingClientRect().width + 2))
  }

  const resolveAdaptiveBase = () => {
    const viewportWidth = Math.max(280, window.visualViewport?.width ?? window.innerWidth)
    const sidePadding = Math.max(24, Math.round(viewportWidth * 0.12))
    const maxWordmarkWidth = Math.max(172, viewportWidth - sidePadding * 2)

    const minBase = viewportWidth < 360 ? 19 : 21
    const maxBase = viewportWidth < 360 ? 29 : 34
    let low = minBase
    let high = maxBase
    let best = minBase

    const prefixText = prefix.textContent?.trim() || 'где'
    const questionText = '?'

    for (let iteration = 0; iteration < 12; iteration += 1) {
      const probe = (low + high) / 2
      const prefixWidth = textWidth(prefixText, probe)
      const questionWidth = textWidth(questionText, probe)
      const maxPhraseWidth = SPLASH_REEL_ITEMS.reduce((widest, item) => {
        const multiplier = parseSizeMultiplier(item.size)
        return Math.max(widest, textWidth(item.text, probe * multiplier))
      }, 0)
      const gapsWidth = probe * 0.28
      const totalWidth = prefixWidth + maxPhraseWidth + questionWidth + gapsWidth

      if (totalWidth <= maxWordmarkWidth) {
        best = probe
        low = probe
      } else {
        high = probe
      }
    }

    return {
      basePx: Math.max(minBase, Math.min(maxBase, best)),
      maxWidthPx: maxWordmarkWidth,
    }
  }

  const refreshAdaptiveSizing = () => {
    const { basePx, maxWidthPx } = resolveAdaptiveBase()
    adaptiveBasePx = basePx
    lockup.style.setProperty('--splash-word-size', `${basePx.toFixed(2)}px`)
    lockup.style.setProperty('--splash-word-max-width', `${Math.round(maxWidthPx)}px`)
  }

  refreshAdaptiveSizing()

  const applyPhrase = (target: HTMLElement, item: SplashPhraseItem) => {
    target.textContent = item.text
    const multiplier = parseSizeMultiplier(item.size)
    target.style.fontSize = `${(adaptiveBasePx * multiplier).toFixed(2)}px`
  }

  const setPhraseTransitionsEnabled = (enabled: boolean) => {
    const value = enabled ? '' : 'none'
    current.style.transition = value
    next.style.transition = value
  }

  const measurePhrase = (item: SplashPhraseItem) => {
    sizer.textContent = item.text
    const multiplier = parseSizeMultiplier(item.size)
    sizer.style.fontSize = `${(adaptiveBasePx * multiplier).toFixed(2)}px`
    const rect = sizer.getBoundingClientRect()
    return {
      width: Math.max(1, Math.ceil(rect.width + 2)),
      height: Math.max(1, Math.ceil(rect.height + 2)),
    }
  }

  const syncRollerSize = (item: SplashPhraseItem) => {
    const nextSize = measurePhrase(item)
    roller.style.width = `${nextSize.width}px`
    roller.style.minHeight = `${nextSize.height}px`
  }

  const cleanup = () => {
    if (stepTimer) window.clearTimeout(stepTimer)
    if (transitionTimer) window.clearTimeout(transitionTimer)
    window.removeEventListener('resize', handleResize)
    window.visualViewport?.removeEventListener('resize', handleResize)
    sizer.remove()
  }

  const handleResize = () => {
    if (!document.body.contains(roller)) {
      cleanup()
      return
    }
    refreshAdaptiveSizing()
    applyPhrase(current, activeItem)
    syncRollerSize(activeItem)
  }

  window.addEventListener('resize', handleResize, { passive: true })
  window.visualViewport?.addEventListener('resize', handleResize)

  applyPhrase(current, activeItem)
  syncRollerSize(activeItem)

  const runStep = () => {
    if (!document.body.contains(roller)) {
      cleanup()
      return
    }
    if (stepIndex >= SPLASH_REEL_ITEMS.length - 1) {
      cleanup()
      return
    }
    stepIndex += 1
    const item = SPLASH_REEL_ITEMS[stepIndex]!
    applyPhrase(next, item)
    syncRollerSize(item)
    roller.dataset.rolling = 'true'
    void appHaptics.trigger('selection')

    transitionTimer = window.setTimeout(() => {
      setPhraseTransitionsEnabled(false)
      applyPhrase(current, item)
      activeItem = item
      roller.dataset.rolling = 'false'
      void roller.offsetHeight
      setPhraseTransitionsEnabled(true)
      stepTimer = window.setTimeout(runStep, SPLASH_REEL_STEP_INTERVAL_MS)
    }, SPLASH_REEL_TRANSITION_MS)
  }

  stepTimer = window.setTimeout(runStep, SPLASH_REEL_START_DELAY_MS)
}

const hideSplash = () => {
  const elapsed = performance.now() - splashMountedAt
  const delay = Math.max(0, MIN_SPLASH_VISIBLE_MS - elapsed)

  window.setTimeout(() => {
    document.body.classList.add('app-loaded')
    const splash = document.getElementById('app-splash')
    if (!splash) {
      return
    }

    splash.classList.add('splash-fading')

    let done = false
    const finalize = () => {
      if (done) return
      done = true
      void appHaptics.trigger('light')
      splash.classList.add('splash-hidden')
      splash.remove()
      try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY)
      } catch {
        // no-op
      }
    }

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== splash || event.propertyName !== 'opacity') {
        return
      }
      splash.removeEventListener('transitionend', handleTransitionEnd)
      finalize()
    }

    splash.addEventListener('transitionend', handleTransitionEnd)
    window.setTimeout(() => {
      splash.removeEventListener('transitionend', handleTransitionEnd)
      finalize()
    }, SPLASH_FADE_FALLBACK_MS)
  }, delay)
}

bindSplashHaptics()
bindSplashPhraseReel()

if (document.readyState === 'complete') {
  hideSplash()
} else {
  window.addEventListener('load', hideSplash, { once: true })
}

bindViewportInsetsSync()
bindChunkLoadRecovery()
installMapNetworkHints()
scheduleMapChunkPrefetch()
warmupMapStyleRequest()

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
