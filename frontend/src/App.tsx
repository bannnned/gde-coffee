import AuthGate from "./components/AuthGate";
import { LayoutMetricsProvider } from "./features/work/layout/LayoutMetricsContext";
import ConfirmEmailChangePage from "./pages/ConfirmEmailChangePage";
import ProfileScreen from "./pages/ProfileScreen";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SettingsScreen from "./pages/SettingsScreen";
import VerifyEmailPage from "./pages/VerifyEmailPage";
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
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/confirm-email-change"
            element={<ConfirmEmailChangePage />}
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
