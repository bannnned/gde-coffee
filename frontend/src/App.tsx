import { Box, Loader } from "@mantine/core";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AuthGate from "./components/AuthGate";
import { LayoutMetricsProvider } from "./features/discovery/layout/LayoutMetricsContext";

const DiscoveryScreen = lazy(() => import("./pages/DiscoveryScreen"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ProfileScreen = lazy(() => import("./pages/ProfileScreen"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const SettingsScreen = lazy(() => import("./pages/SettingsScreen"));
const AdminModerationPage = lazy(() => import("./pages/AdminModerationPage"));
const AdminDrinksPage = lazy(() => import("./pages/AdminDrinksPage"));
const AdminCafesImportPage = lazy(() => import("./pages/AdminCafesImportPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ConfirmEmailChangePage = lazy(() => import("./pages/ConfirmEmailChangePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

function RouteLoader() {
  return (
    <Box
      h="100dvh"
      w="100%"
      style={{
        display: "grid",
        placeItems: "center",
      }}
    >
      <Loader size="sm" />
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Suspense fallback={<RouteLoader />}>
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
            <Route path="/admin/cafes/import" element={<AdminCafesImportPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/confirm-email-change"
              element={<ConfirmEmailChangePage />}
            />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthGate>
    </BrowserRouter>
  );
}
