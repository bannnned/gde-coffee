import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ColorScheme = "light" | "dark";

type AppColorSchemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (value: ColorScheme) => void;
};

const STORAGE_KEY = "gdeCoffeeColorScheme";

const AppColorSchemeContext = createContext<AppColorSchemeContextValue | null>(null);

function getSystemColorScheme(): ColorScheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredColorScheme(): ColorScheme | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark") {
    return value;
  }
  return null;
}

function applyColorSchemeToDocument(value: ColorScheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", value);
  root.style.colorScheme = value;
}

export function AppColorSchemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => readStoredColorScheme() ?? getSystemColorScheme());

  useEffect(() => {
    applyColorSchemeToDocument(colorScheme);
    window.localStorage.setItem(STORAGE_KEY, colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (readStoredColorScheme() !== null) return;
      setColorScheme(mediaQuery.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const value = useMemo<AppColorSchemeContextValue>(
    () => ({
      colorScheme,
      setColorScheme,
    }),
    [colorScheme],
  );

  return createElement(AppColorSchemeContext.Provider, { value }, children);
}

export default function useAppColorScheme(): AppColorSchemeContextValue {
  const context = useContext(AppColorSchemeContext);
  if (context) {
    return context;
  }
  return {
    colorScheme:
      (typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark")
        ? "dark"
        : "light",
    setColorScheme: (value: ColorScheme) => {
      applyColorSchemeToDocument(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, value);
      }
    },
  };
}
