import { IconBrandGithub, IconBrandYandex } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { buildOAuthStartUrl } from "../api/url";
import { useAuth } from "../components/AuthGate";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
import { Button as UIButton } from "../components/ui";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import useOauthRedirect from "../hooks/useOauthRedirect";
import classes from "./LoginPage.module.css";

export default function LoginPage() {
  useAllowBodyScroll();
  const { openAuthModal, status, user, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoOpenedRef = useRef(false);

  const { hasOauthParams } = useOauthRedirect({
    onResultOk: refreshAuth,
  });

  const githubAuthUrl = useMemo(
    () => buildOAuthStartUrl("github"),
    [],
  );
  const yandexAuthUrl = useMemo(
    () => buildOAuthStartUrl("yandex"),
    [],
  );

  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (status !== "unauth" || hasOauthParams) return;
    autoOpenedRef.current = true;
    openAuthModal("login");
  }, [hasOauthParams, openAuthModal, status]);

  const hasSearch = searchParams.toString().length > 0;

  return (
    <main className={classes.page} data-ui="login-screen">
      <section className={classes.card}>
        <div className={classes.stack}>
          <h1 className={classes.title}>Вход</h1>
          {status === "authed" && user ? (
            <p className={classes.muted}>
              Вы уже вошли как {user.email ?? "пользователь"}.
            </p>
          ) : status === "loading" || hasSearch ? (
            <p className={classes.muted}>
              Проверяем авторизацию. Если нужно, откройте форму входа.
            </p>
          ) : (
            <p className={classes.muted}>
              Войдите, чтобы получить доступ к профилю и настройкам.
            </p>
          )}
          <div className={classes.actions}>
            {status === "authed" ? (
              <UIButton
                type="button"
                onClick={() => {
                  void navigate("/");
                }}
              >
                На главную
              </UIButton>
            ) : (
              <UIButton
                type="button"
                onClick={() => openAuthModal("login")}
              >
                Открыть форму входа
              </UIButton>
            )}
            <div className={classes.oauthRow}>
              <button
                type="button"
                className="oauth-button ui-focus-ring"
                aria-label="Войти через GitHub"
                title="GitHub"
                onClick={() => window.location.assign(githubAuthUrl)}
              >
                <IconBrandGithub size={22} />
              </button>
              <button
                type="button"
                className="oauth-button ui-focus-ring"
                aria-label="Войти через Яндекс"
                title="Яндекс"
                onClick={() => window.location.assign(yandexAuthUrl)}
              >
                <IconBrandYandex size={22} />
              </button>
            </div>
            <div className={classes.telegramWrap}>
              <TelegramLoginWidget flow="login" size="medium" />
            </div>
            <UIButton
              type="button"
              variant="secondary"
              onClick={() => {
                void navigate("/");
              }}
            >
              Вернуться назад
            </UIButton>
          </div>
        </div>
      </section>
    </main>
  );
}
