package auth

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/auth/telegram"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const telegramMaxAge = 10 * time.Minute

type telegramStartRequest struct {
	Flow string `json:"flow"`
}

type telegramStartResponse struct {
	State string `json:"state"`
}

type telegramConfigResponse struct {
	BotUsername string `json:"bot_username"`
}

type telegramCallbackRequest struct {
	State     string `json:"state"`
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	PhotoURL  string `json:"photo_url"`
	AuthDate  int64  `json:"auth_date"`
	Hash      string `json:"hash"`
}

func (h Handler) TelegramConfig(c *gin.Context) {
	botUsername := strings.TrimSpace(h.TelegramBotUsername)
	log.Printf("telegram config requested: bot_username=%q", botUsername)
	c.JSON(http.StatusOK, telegramConfigResponse{
		BotUsername: botUsername,
	})
}

func (h Handler) TelegramStart(c *gin.Context) {
	var req telegramStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_argument", "invalid json body", nil)
		return
	}

	flow := strings.ToLower(strings.TrimSpace(req.Flow))
	if flow != oauthFlowLogin && flow != oauthFlowLink {
		respondError(c, http.StatusBadRequest, "invalid_argument", "flow must be login or link", nil)
		return
	}

	userID := ""
	if flow == oauthFlowLink {
		var ok bool
		userID, ok = h.userIDFromSession(c)
		if !ok {
			respondError(c, http.StatusUnauthorized, "unauthorized", "missing session", nil)
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	redirectURI := ""
	if h.Security.BaseURL != "" {
		redirectBase := strings.TrimRight(h.Security.BaseURL, "/")
		if h.OAuthRedirectBase != nil {
			if override := strings.TrimSpace(h.OAuthRedirectBase[ProviderTelegram]); override != "" {
				redirectBase = strings.TrimRight(override, "/")
			}
		}
		redirectURI = redirectBase + "/api/auth/telegram/callback"
	}

	var userPtr *string
	if userID != "" {
		userPtr = &userID
	}
	state, err := CreateOAuthState(ctx, h.Pool, ProviderTelegram, flow, userPtr, redirectURI)
	if err != nil {
		log.Printf("telegram start: create state failed: %v", err)
		respondError(c, http.StatusInternalServerError, "internal", "state create failed", nil)
		return
	}

	c.JSON(http.StatusOK, telegramStartResponse{State: state})
}

func (h Handler) TelegramCallback(c *gin.Context) {
	var req telegramCallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.oauthRedirect(c, ProviderTelegram, "/login", "bad_payload", "", "")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	dest := h.resolveTelegramRedirect(ctx, req.State)

	stateRec, err := ConsumeOAuthState(ctx, h.Pool, ProviderTelegram, strings.TrimSpace(req.State))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.oauthRedirect(c, ProviderTelegram, dest, "invalid_state", "", "")
			return
		}
		log.Printf("telegram callback: consume state failed: %v", err)
		h.oauthRedirect(c, ProviderTelegram, dest, "invalid_state", "", "")
		return
	}

	dest = oauthDefaultRedirect(stateRec.Flow)

	if err := telegram.VerifyLoginPayload(telegram.LoginPayload{
		ID:        req.ID,
		Username:  req.Username,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		PhotoURL:  req.PhotoURL,
		AuthDate:  req.AuthDate,
		Hash:      req.Hash,
	}, h.TelegramBotToken, telegramMaxAge, time.Now()); err != nil {
		code := telegram.ErrorCode(err)
		if code == "" {
			code = "invalid_signature"
		}
		h.oauthRedirect(c, ProviderTelegram, dest, code, "", "")
		return
	}

	displayName := strings.TrimSpace(strings.TrimSpace(req.FirstName + " " + req.LastName))
	if displayName == "" {
		displayName = strings.TrimSpace(req.Username)
	}

	var displayPtr *string
	if displayName != "" {
		displayPtr = &displayName
	}
	var avatarPtr *string
	if strings.TrimSpace(req.PhotoURL) != "" {
		val := req.PhotoURL
		avatarPtr = &val
	}

	identity := Identity{
		Provider:       ProviderTelegram,
		ProviderUserID: strconv.FormatInt(req.ID, 10),
		DisplayName:    displayPtr,
		AvatarURL:      avatarPtr,
	}

	switch stateRec.Flow {
	case oauthFlowLogin:
		userID, _, err := ResolveUserForIdentity(ctx, h.Pool, identity, false)
		if err != nil {
			log.Printf("telegram login: resolve user failed: %v", err)
			h.oauthRedirect(c, ProviderTelegram, dest, "internal", "", "")
			return
		}
		sessionID, _, err := createSession(ctx, h.Pool, userID, c.ClientIP(), c.GetHeader("User-Agent"))
		if err != nil {
			log.Printf("telegram login: session create failed: %v", err)
			h.oauthRedirect(c, ProviderTelegram, dest, "internal", "", "")
			return
		}
		setSessionCookie(c, sessionID, h.CookieSecure)
		h.oauthRedirect(c, ProviderTelegram, dest, "", "", "ok")
		return
	case oauthFlowLink:
		if stateRec.UserID == nil || *stateRec.UserID == "" {
			h.oauthRedirect(c, ProviderTelegram, dest, "invalid_state", "", "")
			return
		}
		targetUserID := *stateRec.UserID

		foundIdentity, found, err := GetIdentity(ctx, h.Pool, ProviderTelegram, identity.ProviderUserID)
		if err != nil {
			log.Printf("telegram link: identity lookup failed: %v", err)
			h.oauthRedirect(c, ProviderTelegram, dest, "internal", "", "")
			return
		}
		if found {
			if foundIdentity.UserID != targetUserID {
				h.oauthRedirect(c, ProviderTelegram, dest, "already_linked", "", "")
				return
			}
		} else {
			identity.UserID = targetUserID
			if err := CreateIdentity(ctx, h.Pool, identity); err != nil {
				if isUniqueViolation(err) {
					h.oauthRedirect(c, ProviderTelegram, dest, "already_linked", "", "")
					return
				}
				log.Printf("telegram link: identity create failed: %v", err)
				h.oauthRedirect(c, ProviderTelegram, dest, "internal", "", "")
				return
			}
		}

		if identity.AvatarURL != nil && strings.TrimSpace(*identity.AvatarURL) != "" {
			if _, err := h.Pool.Exec(
				ctx,
				`update users set avatar_url = $2 where id = $1 and (avatar_url is null or avatar_url = '')`,
				targetUserID,
				*identity.AvatarURL,
			); err != nil {
				log.Printf("telegram link: update avatar failed: %v", err)
			}
		}

		h.oauthRedirect(c, ProviderTelegram, dest, "", "", "linked")
		return
	default:
		h.oauthRedirect(c, ProviderTelegram, dest, "invalid_state", "", "")
		return
	}
}

func (h Handler) userIDFromSession(c *gin.Context) (string, bool) {
	sid, err := c.Cookie(cookieName)
	if err != nil || sid == "" {
		return "", false
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), queryTimeout)
	defer cancel()
	user, _, err := getUserBySession(ctx, h.Pool, sid)
	if err != nil {
		return "", false
	}
	return user.ID, true
}

func (h Handler) resolveTelegramRedirect(ctx context.Context, rawState string) string {
	flow := h.lookupOAuthFlow(ctx, ProviderTelegram, rawState)
	return oauthDefaultRedirect(flow)
}

func (h Handler) lookupOAuthFlow(ctx context.Context, provider Provider, rawState string) string {
	rawState = strings.TrimSpace(rawState)
	if rawState == "" {
		return ""
	}
	hash := HashToken(rawState)
	var flow string
	err := h.Pool.QueryRow(ctx, `
		select flow from oauth_states where token_hash = $1 and provider = $2
	`, hash, string(provider)).Scan(&flow)
	if err != nil {
		return ""
	}
	return flow
}
