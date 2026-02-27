import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as authApi from "../../../api/auth";
import * as reputationApi from "../../../api/reputation";
import { extractApiErrorMessage, extractApiErrorStatus } from "../../../utils/apiError";
import { resolveAvatarUrl } from "../../../utils/resolveAvatarUrl";

type AuthStatus = "loading" | "authed" | "unauth" | "error";

type UseProfileAccountParams = {
  user: authApi.AuthUser | null;
  status: AuthStatus;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

export default function useProfileAccount({
  user,
  status,
  refreshAuth,
  logout,
}: UseProfileAccountParams) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [reputationProfile, setReputationProfile] =
    useState<reputationApi.MyReputationProfile | null>(null);
  const [isReputationLoading, setIsReputationLoading] = useState(false);
  const [reputationError, setReputationError] = useState<string | null>(null);

  const profile = useMemo(() => {
    const name = user?.displayName?.trim() || user?.name?.trim() || "Без имени";
    const email = user?.email?.trim() || "Email не указан";
    const id = user?.id ?? "—";
    const initial = (user?.displayName || user?.name || user?.email || "?")
      .trim()
      .charAt(0)
      .toUpperCase();
    const isVerified = Boolean(user?.emailVerifiedAt);
    const avatarUrl = resolveAvatarUrl(user?.avatarUrl);

    return { name, email, id, initial, isVerified, avatarUrl };
  }, [user]);

  const refreshReputationProfile = useCallback(async () => {
    if (status !== "authed") {
      setReputationProfile(null);
      setReputationError(null);
      return;
    }
    setIsReputationLoading(true);
    setReputationError(null);
    try {
      const nextProfile = await reputationApi.getMyReputationProfile();
      setReputationProfile(nextProfile);
    } catch (err: unknown) {
      const statusCode = extractApiErrorStatus(err);
      const message = extractApiErrorMessage(err, "Не удалось обновить уровень.");
      // Backward-compatible fallback: some environments may not expose
      // /api/reputation/me yet. Do not show a scary error in profile.
      if (statusCode === 404 || /^not found$/i.test(message.trim())) {
        if (import.meta.env.DEV) {
          // Silent fallback in UI, but keep debug signal in local console.
          console.info("[profile:reputation] /api/reputation/me is unavailable, using defaults");
        }
        setReputationError(null);
      } else {
        setReputationError(message);
      }
      setReputationProfile(null);
    } finally {
      setIsReputationLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authed") {
      setReputationProfile(null);
      setReputationError(null);
      setIsReputationLoading(false);
      return;
    }
    void refreshReputationProfile();
  }, [refreshReputationProfile, status]);

  const handleLogout = async (onDone?: () => void) => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      if (onDone) onDone();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Нужен файл изображения.");
      setAvatarSuccess(null);
      return;
    }

    setIsAvatarUploading(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const presigned = await authApi.presignProfileAvatarUpload({
        contentType: file.type,
        sizeBytes: file.size,
      });
      await authApi.uploadProfileAvatarByPresignedUrl(
        presigned.upload_url,
        file,
        presigned.headers ?? {},
      );
      await authApi.confirmProfileAvatarUpload(presigned.object_key);
      await refreshAuth();
      setAvatarSuccess("Фото профиля обновлено.");
    } catch (err: unknown) {
      setAvatarError(extractApiErrorMessage(err, "Не удалось обновить фото профиля."));
    } finally {
      setIsAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  return {
    profile,
    avatarInputRef,
    isLoggingOut,
    isAvatarUploading,
    avatarError,
    avatarSuccess,
    reputationProfile,
    isReputationLoading,
    reputationError,
    handleLogout,
    handleAvatarPick,
    handleAvatarSelected,
  };
}

