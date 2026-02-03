import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconSun, IconMoon } from '@tabler/icons-react'

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })

  const next = computed === 'light' ? 'dark' : 'light'

  return (
    <ActionIcon
      variant="transparent"
      size={42}
      className="glass-action glass-action--square"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(next)}
    >
      {computed === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
    </ActionIcon>
  )
}
