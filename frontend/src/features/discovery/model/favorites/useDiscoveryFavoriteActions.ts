import { useEffect } from "react";

import { addCafeToFavorites, removeCafeFromFavorites } from "../../../../api/favorites";
import type { Cafe } from "../../../../entities/cafe/model/types";
import { appHaptics } from "../../../../lib/haptics";
import { notifications } from "../../../../lib/notifications";
import { extractApiErrorMessage } from "../../../../utils/apiError";

type UseDiscoveryFavoriteActionsParams = {
  user: unknown;
  openAuthModal: (mode?: "login" | "register") => void;
  selectedCafe: Cafe | null;
  favoritesOnly: boolean;
  setFavoritesOnly: (next: boolean | ((prev: boolean) => boolean)) => void;
  favoriteBusyCafeId: string | null;
  setFavoriteBusyCafeId: (next: string | null) => void;
};

export default function useDiscoveryFavoriteActions({
  user,
  openAuthModal,
  selectedCafe,
  favoritesOnly,
  setFavoritesOnly,
  favoriteBusyCafeId,
  setFavoriteBusyCafeId,
}: UseDiscoveryFavoriteActionsParams) {
  useEffect(() => {
    if (user || !favoritesOnly) return;
    setFavoritesOnly(false);
  }, [favoritesOnly, setFavoritesOnly, user]);

  const handleToggleFavoritesFilter = () => {
    if (!user) {
      void appHaptics.trigger("warning");
      openAuthModal("login");
      return;
    }
    void appHaptics.trigger("selection");
    setFavoritesOnly((prev) => !prev);
  };

  const handleToggleFavorite = async (afterChange?: () => Promise<unknown>) => {
    if (!selectedCafe) return;
    if (!user) {
      void appHaptics.trigger("warning");
      openAuthModal("login");
      return;
    }
    if (favoriteBusyCafeId === selectedCafe.id) return;

    setFavoriteBusyCafeId(selectedCafe.id);
    try {
      if (selectedCafe.is_favorite) {
        await removeCafeFromFavorites(selectedCafe.id);
      } else {
        await addCafeToFavorites(selectedCafe.id);
      }
      if (afterChange) {
        await afterChange();
      }
      void appHaptics.trigger("success");
    } catch (error: unknown) {
      void appHaptics.trigger("error");
      notifications.show({
        color: "red",
        title: "Ошибка",
        message: extractApiErrorMessage(error, "Не удалось обновить избранное."),
      });
    } finally {
      setFavoriteBusyCafeId(null);
    }
  };

  return {
    handleToggleFavoritesFilter,
    handleToggleFavorite,
  };
}
