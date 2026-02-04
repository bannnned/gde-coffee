import { LayoutMetricsProvider } from "./features/work/layout/LayoutMetricsContext";
import WorkScreen from "./pages/WorkScreen";

export default function App() {
  return (
    <LayoutMetricsProvider>
      <WorkScreen />
    </LayoutMetricsProvider>
  );
}
