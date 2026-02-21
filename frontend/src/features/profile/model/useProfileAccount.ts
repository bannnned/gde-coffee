import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconBrandGithub,
  IconBrandTelegram,
  IconBrandYandex,
  type Icon,
} from "@tabler/icons-react";

import * as authApi from "../../../api/auth";
import * as reputationApi from "../../../api/reputation";
import { buildOAuthLinkUrl } from "../../../api/url";
import useOauthRedirect from "../../../hooks/useOauthRedirect";
import { extractApiErrorMessage, extractApiErrorStatus } from "../../../utils/apiError";
import { resolveAvatarUrl } from "../../../utils/resolveAvatarUrl";

type AuthStatus = "loading" | "authed" | "unauth" | "error";

type UseProfileAccountParams = {
  user: authApi.AuthUser | null;
  status: AuthStatus;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

type SocialStatus = {
  id: "github" | "yandex" | "telegram";
  label: string;
  linked: boolean;
  icon: Icon;
};

export default function useProfileAccount({
  user,
  status,
  refreshAuth,
  logout,
}: UseProfileAccountParams) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [identities, setIdentities] = useState<authApi.AuthIdentity[]>([]);
  const [isIdentitiesLoading, setIsIdentitiesLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [isNameSaving, setIsNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [reputationProfile, setReputationProfile] =
    useState<reputationApi.MyReputationProfile | null>(null);
  const [isReputationLoading, setIsReputationLoading] = useState(false);
  const [reputationError, setReputationError] = useState<string | null>(null);

  const profile = useMemo(() => {
    const name = user?.name?.trim() || user?.displayName?.trim() || "Без имени";
    const email = user?.email?.trim() || "Email не указан";
    const id = user?.id ?? "—";
    const initial = (user?.name || user?.displayName || user?.email || "?")
      .trim()
      .charAt(0)
      .toUpperCase();
    const isVerified = Boolean(user?.emailVerifiedAt);
    const avatarUrl = resolveAvatarUrl(user?.avatarUrl);

    return { name, email, id, initial, isVerified, avatarUrl };
  }, [user]);

  const editableName = useMemo(
    () => user?.displayName?.trim() || user?.name?.trim() || "",
    [user],
  );

  useEffect(() => {
    setNameDraft(editableName);
  }, [editableName]);

  const githubAuthUrl = useMemo(() => buildOAuthLinkUrl("github"), []);
  const yandexAuthUrl = useMemo(() => buildOAuthLinkUrl("yandex"), []);

  const isProviderLinked = useCallback(
    (providerName: string) =>
      identities.some((identity) => {
        const provider = identity.provider ?? identity.type ?? identity.name ?? "";
        return provider.toString().toLowerCase() === providerName;
      }),
    [identities],
  );

  const githubLinked = useMemo(() => isProviderLinked("github"), [isProviderLinked]);
  const yandexLinked = useMemo(() => isProviderLinked("yandex"), [isProviderLinked]);
  const telegramLinked = useMemo(
    () => isProviderLinked("telegram"),
    [isProviderLinked],
  );

  const refreshIdentities = useCallback(async () => {
    if (status !== "authed") {
      setIdentities([]);
      return;
    }

    setIsIdentitiesLoading(true);
    setIdentityError(null);
    try {
      const list = await authApi.getIdentities();
      setIdentities(list);
    } catch (err: unknown) {
      const statusCode = extractApiErrorStatus(err);
      if (statusCode && statusCode !== 404) {
        setIdentityError(extractApiErrorMessage(err, "Не удалось обновить список подключений."));
      }
      setIdentities([]);
    } finally {
      setIsIdentitiesLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authed") return;
    void refreshIdentities();
  }, [refreshIdentities, status]);

  const refreshReputationProfile = useCallback(async () => {
    if (status !== "authed") {
      setReputationProfile(null);
      setReputationError(null);
      return;
    }
    setIsReputationLoading(true);
    setReputationError(null);
    try {
      const profile = await reputationApi.getMyReputationProfile();
      setReputationProfile(profile);
    } catch (err: unknown) {
      setReputationError(extractApiErrorMessage(err, "Не удалось обновить уровень."));
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

  useOauthRedirect({
    onResultOk: refreshAuth,
    onResultLinked: refreshIdentities,
    providerFallback: "соцсеть",
  });

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

  const handleNameEditStart = () => {
    setIsNameEditing(true);
    setNameDraft(editableName);
    setNameError(null);
    setNameSuccess(null);
  };

  const handleNameEditCancel = () => {
    setIsNameEditing(false);
    setNameDraft(editableName);
    setNameError(null);
  };

  const handleNameSave = async () => {
    const nextName = nameDraft.trim();
    if (!nextName) {
      setNameError("Введите имя профиля.");
      return;
    }
    setIsNameSaving(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      await authApi.updateProfileName({ displayName: nextName });
      await refreshAuth();
      setNameSuccess("Имя сохранено.");
      setIsNameEditing(false);
    } catch (err: unknown) {
      setNameError(extractApiErrorMessage(err, "Не удалось сохранить имя."));
    } finally {
      setIsNameSaving(false);
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

  const socialStatuses = useMemo<SocialStatus[]>(
    () => [
      {
        id: "github",
        label: "GitHub",
        linked: githubLinked,
        icon: IconBrandGithub,
      },
      {
        id: "yandex",
        label: "Яндекс",
        linked: yandexLinked,
        icon: IconBrandYandex,
      },
      {
        id: "telegram",
        label: "Telegram",
        linked: telegramLinked,
        icon: IconBrandTelegram,
      },
    ],
    [githubLinked, telegramLinked, yandexLinked],
  );

  return {
    profile,
    githubAuthUrl,
    yandexAuthUrl,
    githubLinked,
    yandexLinked,
    telegramLinked,
    socialStatuses,
    avatarInputRef,
    isLoggingOut,
    isIdentitiesLoading,
    identityError,
    nameDraft,
    isNameEditing,
    isNameSaving,
    nameError,
    nameSuccess,
    isAvatarUploading,
    avatarError,
    avatarSuccess,
    reputationProfile,
    isReputationLoading,
    reputationError,
    setNameDraft,
    setNameError,
    setNameSuccess,
    handleLogout,
    handleNameEditStart,
    handleNameEditCancel,
    handleNameSave,
    handleAvatarPick,
    handleAvatarSelected,
  };
}
