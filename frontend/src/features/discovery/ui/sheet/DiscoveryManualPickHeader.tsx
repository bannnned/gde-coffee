import classes from "./DiscoveryManualPickHeader.module.css";

export default function DiscoveryManualPickHeader() {
  return (
    <div className={classes.card}>
      <div className={classes.content}>
        <p className={classes.title}>Выбор точки на карте</p>
        <p className={classes.subtitle}>
          Передвигайте карту. Точка фиксируется по пину в центре открытой области.
        </p>
      </div>
    </div>
  );
}
