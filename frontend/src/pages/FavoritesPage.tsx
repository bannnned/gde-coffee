import { IconArrowLeft, IconHeartFilled } from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listFavoriteCafes, removeCafeFromFavorites } from "../api/favorites";
import { useAuth } from "../components/AuthGate";
import { Button as UIButton } from "../components/ui";
import type { Cafe } from "../entities/cafe/model/types";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import classes from "./FavoritesPage.module.css";

const CafeDetailsScreen = lazy(() => import("../features/discovery/ui/details/CafeDetailsScreen"));

type FavoritesErrorLike = {
  normalized?: {
    message?: string;
  };
  response?: {
    data?: {
      message?: string;
    };
  };
};

function extractFavoritesErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const err = error as FavoritesErrorLike;
  return err.normalized?.message ?? err.response?.data?.message ?? fallback;
}

export default function FavoritesPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status, openAuthModal } = useAuth();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyCafeId, setBusyCafeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const title = useMemo(
    () => (cafes.length === 1 ? "1 кофейня" : `${cafes.length} кофеен`),
    [cafes.length],
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      openAuthModal("login");
      void navigate("/profile", { replace: true });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listFavoriteCafes()
      .then((items) => {
        if (cancelled) return;
        setCafes(items);
      })
      .catch((responseError: unknown) => {
        if (cancelled) return;
        const message = extractFavoritesErrorMessage(
          responseError,
          "Не удалось загрузить избранные кофейни.",
        );
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, openAuthModal, status, user]);

  const handleRemove = async (cafeId: string) => {
    if (busyCafeId) return;
    setBusyCafeId(cafeId);
    setError(null);
    try {
      await removeCafeFromFavorites(cafeId);
      setCafes((prev) => prev.filter((item) => item.id !== cafeId));
    } catch (responseError: unknown) {
      const message = extractFavoritesErrorMessage(responseError, "Не удалось обновить избранное.");
      setError(message);
    } finally {
      setBusyCafeId(null);
    }
  };

  return (
    <main className={classes.screen} data-ui="favorites-screen">
      <div className={classes.container}>
        <header className={classes.header}>
          <div className={classes.headerGroup}>
            <UIButton
              type="button"
              variant="ghost"
              size="icon"
              className={`${classes.iconButton} glass-action glass-action--square`}
              onClick={() => {
                void navigate("/profile");
              }}
              aria-label="Назад"
            >
              <IconArrowLeft size={18} />
            </UIButton>
            <h1 className={classes.title}>Избранные</h1>
          </div>
          <div className={classes.headerMeta}>
            <p className={classes.count}>{title}</p>
            <span
              className={`${classes.iconButton} ${classes.activeIcon} glass-action glass-action--square glass-action--active`}
              aria-label="Страница избранных кофеен"
            >
              <IconHeartFilled size={18} />
            </span>
          </div>
        </header>

        {isLoading && (
          <section className={classes.notice}>
            Загружаем избранные кофейни...
          </section>
        )}

        {error && (
          <section className={`${classes.notice} ${classes.noticeError}`}>
            {error}
          </section>
        )}

        {!isLoading && cafes.length === 0 && !error && (
          <section className={classes.notice}>
            Пока нет избранных мест. Нажмите сердечко у кофейни.
          </section>
        )}

        <div className={classes.list}>
          {cafes.map((cafe) => {
            const cover = cafe.cover_photo_url ?? cafe.photos?.[0]?.url;
            const isRemoving = busyCafeId === cafe.id;
            return (
              <article
                key={cafe.id}
                className={classes.card}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedCafe(cafe);
                  setDetailsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedCafe(cafe);
                  setDetailsOpen(true);
                }}
              >
                <div className={classes.cardBody}>
                  {cover && (
                    <div className={classes.cover}>
                      <img
                        src={cover}
                        alt={`Фото: ${cafe.name}`}
                        loading="lazy"
                        className={classes.coverImage}
                      />
                    </div>
                  )}
                  <div className={classes.metaRow}>
                    <div className={classes.meta}>
                      <p className={classes.name}>{cafe.name}</p>
                      <p className={classes.address}>{cafe.address}</p>
                    </div>
                    <UIButton
                      type="button"
                      size="icon"
                      variant="secondary"
                      className={classes.removeButton}
                      aria-label="Убрать из избранного"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRemove(cafe.id);
                      }}
                      disabled={isRemoving}
                    >
                      {isRemoving ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <IconHeartFilled size={16} />
                      )}
                    </UIButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {detailsOpen && (
        <Suspense fallback={null}>
          <CafeDetailsScreen
            opened={detailsOpen}
            cafe={selectedCafe}
            onClose={() => setDetailsOpen(false)}
            showDistance={false}
            showRoutes={false}
          />
        </Suspense>
      )}
    </main>
  );
}
