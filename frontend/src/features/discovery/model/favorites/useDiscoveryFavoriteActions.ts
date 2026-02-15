import { useEffect } from "react";

import { addCafeToFavorites, removeCafeFromFavorites } from "../../../../api/favorites";
import type { Cafe } from "../../../../entities/cafe/model/types";

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
      openAuthModal("login");
      return;
    }
    setFavoritesOnly((prev) => !prev);
  };

  const handleToggleFavorite = async (afterChange?: () => Promise<unknown>) => {
    if (!selectedCafe) return;
    if (!user) {
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
    } finally {
      setFavoriteBusyCafeId(null);
    }
  };

  return {
    handleToggleFavoritesFilter,
    handleToggleFavorite,
  };
}
