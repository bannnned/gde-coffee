import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  APP_HAPTIC_PRESETS,
  appHaptics,
  type AppHapticInput,
  type AppHapticPreset,
} from "../lib/haptics";

type AppHapticsContextValue = {
  enabled: boolean;
  isSupported: boolean;
  presets: readonly AppHapticPreset[];
  setEnabled: (value: boolean) => void;
  trigger: (input?: AppHapticInput) => Promise<boolean>;
  cancel: () => void;
};

const AppHapticsContext = createContext<AppHapticsContextValue | null>(null);

export function AppHapticsProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabledState] = useState(() => appHaptics.getEnabled());
  const isSupported = useMemo(() => appHaptics.getIsSupported(), []);

  const setEnabled = useCallback((value: boolean) => {
    appHaptics.setEnabled(value);
    setEnabledState(value);
  }, []);

  const trigger = useCallback(async (input?: AppHapticInput) => {
    return appHaptics.trigger(input);
  }, []);

  const cancel = useCallback(() => {
    appHaptics.cancel();
  }, []);

  const value = useMemo<AppHapticsContextValue>(
    () => ({
      enabled,
      isSupported,
      presets: APP_HAPTIC_PRESETS,
      setEnabled,
      trigger,
      cancel,
    }),
    [cancel, enabled, isSupported, setEnabled, trigger],
  );

  useEffect(() => {
    const api = {
      getEnabled: () => enabled,
      setEnabled,
      isSupported,
      trigger,
      cancel,
      presets: APP_HAPTIC_PRESETS,
    };
    (window as Window & { gdeCoffeeHaptics?: typeof api }).gdeCoffeeHaptics = api;
    return () => {
      delete (window as Window & { gdeCoffeeHaptics?: typeof api }).gdeCoffeeHaptics;
    };
  }, [cancel, enabled, isSupported, setEnabled, trigger]);

  return (
    <AppHapticsContext.Provider value={value}>
      {children}
    </AppHapticsContext.Provider>
  );
}

export default function useAppHaptics(): AppHapticsContextValue {
  const context = useContext(AppHapticsContext);
  if (context) return context;

  return {
    enabled: appHaptics.getEnabled(),
    isSupported: appHaptics.getIsSupported(),
    presets: APP_HAPTIC_PRESETS,
    setEnabled: (value: boolean) => {
      appHaptics.setEnabled(value);
    },
    trigger: async (input?: AppHapticInput) => {
      return appHaptics.trigger(input);
    },
    cancel: () => {
      appHaptics.cancel();
    },
  };
}
