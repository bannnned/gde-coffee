import { Button } from "../../../../components/ui";
import { AppSelect } from "../../../../ui/bridge";
import classes from "./DiscoveryLocationChoiceHeader.module.css";

type LocationOption = {
  id: string;
  label: string;
};

type DiscoveryLocationChoiceHeaderProps = {
  locationOptions: LocationOption[];
  selectedLocationId: string;
  onLocateMe: () => void;
  onStartManualPick: () => void;
  onSelectLocation: (id: string) => void;
};

export default function DiscoveryLocationChoiceHeader({
  locationOptions,
  selectedLocationId,
  onLocateMe,
  onStartManualPick,
  onSelectLocation,
}: DiscoveryLocationChoiceHeaderProps) {
  const selectStyles = {
    input: {
      height: 40,
      borderRadius: 14,
      border: "1px solid var(--border)",
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 72%, transparent))",
      color: "var(--text)",
    },
    dropdown: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface) 88%, transparent))",
      boxShadow:
        "0 12px 24px color-mix(in srgb, var(--color-surface-overlay-soft) 58%, transparent)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  return (
    <div className={classes.card}>
      <div className={classes.content}>
        <p className={classes.title}>Выберите, как определить точку поиска</p>
        <Button
          type="button"
          size="sm"
          className={`${classes.actionButton} ${classes.locateButton}`}
          onClick={onLocateMe}
        >
          Включить геолокацию
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={classes.actionButton}
          onClick={onStartManualPick}
        >
          Выбрать вручную на карте
        </Button>
        <AppSelect
          className={classes.select}
          data={locationOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          value={selectedLocationId || null}
          placeholder="Или выбрать город"
          searchable
          nothingFoundMessage="Ничего не найдено"
          styles={selectStyles}
          onChange={(value) => {
            if (!value) return;
            onSelectLocation(value);
          }}
        />
      </div>
    </div>
  );
}
