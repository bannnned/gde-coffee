import AuthGate from "./components/AuthGate";
import { LayoutMetricsProvider } from "./features/work/layout/LayoutMetricsContext";
import ProfileScreen from "./pages/ProfileScreen";
import WorkScreen from "./pages/WorkScreen";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route
            path="/"
            element={
              <LayoutMetricsProvider>
                <WorkScreen />
              </LayoutMetricsProvider>
            }
          />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
