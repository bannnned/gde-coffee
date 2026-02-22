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
  sheetState: SheetState;
  setSheetHeight: (value: number) => void;
  setFiltersBarHeight: (value: number) => void;
  setSheetState: (value: SheetState) => void;
};

const LayoutMetricsContext = createContext<LayoutMetricsValue | null>(null);

const readViewportHeight = () =>
  window.visualViewport?.height ?? window.innerHeight;

export function LayoutMetricsProvider({ children }: PropsWithChildren) {
  const [sheetHeight, setSheetHeightState] = useState(240);
  const [filtersBarHeight, setFiltersBarHeightState] = useState(0);
  const [sheetState, setSheetState] = useState<SheetState>("mid");
  const [safeViewportHeight, setSafeViewportHeight] = useState(() =>
    Math.max(0, readViewportHeight()),
  );
  const sheetHeightRef = useRef(sheetHeight);
  const filtersBarHeightRef = useRef(filtersBarHeight);

  useLayoutEffect(() => {
    const update = () => {
      setSafeViewportHeight(Math.max(0, readViewportHeight()));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("pageshow", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("pageshow", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
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
      sheetState,
      setSheetHeight,
      setFiltersBarHeight,
      setSheetState,
    }),
    [
      filtersBarHeight,
      safeViewportHeight,
      sheetHeight,
      sheetState,
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
