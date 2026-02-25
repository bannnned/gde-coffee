import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

export type SheetState = "peek" | "mid" | "expanded";

type LayoutMetricsValue = {
  sheetHeight: number;
  filtersBarHeight: number;
  safeViewportHeight: number;
  safeViewportWidth: number;
  visualViewportScale: number;
  sheetState: SheetState;
  setSheetHeight: (value: number) => void;
  setFiltersBarHeight: (value: number) => void;
  setSheetState: (value: SheetState) => void;
};

const LayoutMetricsContext = createContext<LayoutMetricsValue | null>(null);

type ViewportSnapshot = {
  height: number;
  width: number;
  offsetTop: number;
  offsetBottom: number;
  scale: number;
};

const readViewportSnapshot = (): ViewportSnapshot => {
  if (typeof window === "undefined") {
    return {
      height: 0,
      width: 0,
      offsetTop: 0,
      offsetBottom: 0,
      scale: 1,
    };
  }

  const vv = window.visualViewport;
  const height = Math.max(0, vv?.height ?? window.innerHeight);
  const width = Math.max(0, vv?.width ?? window.innerWidth);
  const offsetTop = Math.max(0, vv?.offsetTop ?? 0);
  const offsetBottom = Math.max(
    0,
    vv ? window.innerHeight - vv.height - vv.offsetTop : 0,
  );
  const scaleRaw = vv?.scale ?? 1;
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;
  return {
    height,
    width,
    offsetTop,
    offsetBottom,
    scale,
  };
};

const px = (value: number) => `${Math.max(0, Math.round(value))}px`;

const setRootVar = (name: string, value: string) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.style.getPropertyValue(name) === value) return;
  root.style.setProperty(name, value);
};

export function LayoutMetricsProvider({ children }: PropsWithChildren) {
  const initialViewport = readViewportSnapshot();
  const [sheetHeight, setSheetHeightState] = useState(240);
  const [filtersBarHeight, setFiltersBarHeightState] = useState(0);
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const [safeViewportHeight, setSafeViewportHeight] = useState(() =>
    Math.max(0, initialViewport.height),
  );
  const [safeViewportWidth, setSafeViewportWidth] = useState(() =>
    Math.max(0, initialViewport.width),
  );
  const [visualViewportScale, setVisualViewportScale] = useState(() =>
    Math.max(0.5, Math.min(4, initialViewport.scale)),
  );
  const sheetHeightRef = useRef(sheetHeight);
  const filtersBarHeightRef = useRef(filtersBarHeight);
  const viewportHeightRef = useRef(safeViewportHeight);
  const viewportWidthRef = useRef(safeViewportWidth);
  const viewportScaleRef = useRef(visualViewportScale);

  useLayoutEffect(() => {
    let raf: number | null = null;

    const apply = (next: ViewportSnapshot) => {
      const nextHeight = Math.max(0, Math.round(next.height));
      const nextWidth = Math.max(0, Math.round(next.width));
      const nextScale = Math.max(0.5, Math.min(4, next.scale));

      if (Math.abs(viewportHeightRef.current - nextHeight) >= 1) {
        viewportHeightRef.current = nextHeight;
        setSafeViewportHeight(nextHeight);
      }
      if (Math.abs(viewportWidthRef.current - nextWidth) >= 1) {
        viewportWidthRef.current = nextWidth;
        setSafeViewportWidth(nextWidth);
      }
      if (Math.abs(viewportScaleRef.current - nextScale) >= 0.01) {
        viewportScaleRef.current = nextScale;
        setVisualViewportScale(nextScale);
      }

      setRootVar("--app-vh", px(nextHeight));
      setRootVar("--app-vw", px(nextWidth));
      setRootVar("--vv-offset-top", px(next.offsetTop));
      setRootVar("--vv-offset-bottom", px(next.offsetBottom));
      setRootVar("--vv-scale", nextScale.toFixed(3));
    };

    const scheduleUpdate = () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
      raf = window.requestAnimationFrame(() => {
        raf = null;
        apply(readViewportSnapshot());
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleUpdate();
      }
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate);
    window.addEventListener("pageshow", scheduleUpdate);
    window.addEventListener("focus", scheduleUpdate);
    document.addEventListener("visibilitychange", handleVisibility);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.removeEventListener("pageshow", scheduleUpdate);
      window.removeEventListener("focus", scheduleUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
    };
  }, []);

  const setSheetHeight = useCallback((value: number) => {
    const next = Math.max(0, Math.round(value));
    if (Math.abs(sheetHeightRef.current - next) < 1) return;
    sheetHeightRef.current = next;
    setSheetHeightState(next);
  }, []);

  const setFiltersBarHeight = useCallback((value: number) => {
    const next = Math.max(0, Math.round(value));
    if (Math.abs(filtersBarHeightRef.current - next) < 1) return;
    filtersBarHeightRef.current = next;
    setFiltersBarHeightState(next);
  }, []);

  const value = useMemo(
    () => ({
      sheetHeight,
      filtersBarHeight,
      safeViewportHeight,
      safeViewportWidth,
      visualViewportScale,
      sheetState,
      setSheetHeight,
      setFiltersBarHeight,
      setSheetState,
    }),
    [
      filtersBarHeight,
      safeViewportHeight,
      safeViewportWidth,
      sheetHeight,
      sheetState,
      visualViewportScale,
      setFiltersBarHeight,
      setSheetHeight,
    ],
  );

  return (
    <LayoutMetricsContext.Provider value={value}>
      {children}
    </LayoutMetricsContext.Provider>
  );
}

export function useLayoutMetrics() {
  const ctx = useContext(LayoutMetricsContext);
  if (!ctx) {
    throw new Error("useLayoutMetrics must be used within LayoutMetricsProvider");
  }
  return ctx;
}
