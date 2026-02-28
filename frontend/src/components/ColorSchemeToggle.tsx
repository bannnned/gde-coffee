import { IconMoon, IconSun } from "@tabler/icons-react";

import useAppColorScheme from "../hooks/useAppColorScheme";
import { Button as UIButton } from "./ui";

export function ColorSchemeToggle() {
  const { setColorScheme, colorScheme } = useAppColorScheme();

  const next = colorScheme === "light" ? "dark" : "light";

  return (
    <UIButton
      type="button"
      variant="ghost"
      size="icon"
      className="glass-action glass-action--square"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(next)}
    >
      {colorScheme === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
    </UIButton>
  );
}
