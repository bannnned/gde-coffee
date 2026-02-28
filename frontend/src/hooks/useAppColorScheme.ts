import { useComputedColorScheme, useMantineColorScheme } from "@mantine/core";

type ColorScheme = "light" | "dark";

type UseAppColorSchemeResult = {
  colorScheme: ColorScheme;
  setColorScheme: (value: ColorScheme) => void;
};

export default function useAppColorScheme(): UseAppColorSchemeResult {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return {
    colorScheme: computedColorScheme === "dark" ? "dark" : "light",
    setColorScheme,
  };
}
