import AuthGate from "./components/AuthGate";
import { LayoutMetricsProvider } from "./features/discovery/layout/LayoutMetricsContext";
import ConfirmEmailChangePage from "./pages/ConfirmEmailChangePage";
import FavoritesPage from "./pages/FavoritesPage";
import LoginPage from "./pages/LoginPage";
import AdminModerationPage from "./pages/AdminModerationPage";
import AdminDrinksPage from "./pages/AdminDrinksPage";
import ProfileScreen from "./pages/ProfileScreen";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SettingsScreen from "./pages/SettingsScreen";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import DiscoveryScreen from "./pages/DiscoveryScreen";
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
                <DiscoveryScreen />
              </LayoutMetricsProvider>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/admin/moderation" element={<AdminModerationPage />} />
          <Route path="/admin/drinks" element={<AdminDrinksPage />} />
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
