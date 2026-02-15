package auth

var authErrorMessageRu = map[string]string{
	"invalid json body":                     "Некорректный JSON в запросе.",
	"email is required":                     "Укажите email.",
	"password is required":                  "Укажите пароль.",
	"password hash failed":                  "Не удалось обработать пароль.",
	"db begin failed":                       "Внутренняя ошибка сервера.",
	"db commit failed":                      "Внутренняя ошибка сервера.",
	"db insert failed":                      "Внутренняя ошибка сервера.",
	"db query failed":                       "Внутренняя ошибка сервера.",
	"db update failed":                      "Внутренняя ошибка сервера.",
	"user create failed":                    "Не удалось создать пользователя.",
	"credential create failed":              "Не удалось создать учетные данные.",
	"credential update failed":              "Не удалось обновить учетные данные.",
	"identity create failed":                "Не удалось привязать аккаунт.",
	"session create failed":                 "Не удалось создать сессию.",
	"email already registered":              "Этот email уже зарегистрирован.",
	"email and password are required":       "Укажите email и пароль.",
	"too many login attempts":               "Слишком много попыток входа. Попробуйте позже.",
	"invalid credentials":                   "Неверный email или пароль.",
	"internal error":                        "Внутренняя ошибка сервера.",
	"missing session":                       "Сессия не найдена. Войдите снова.",
	"invalid session":                       "Сессия недействительна. Войдите снова.",
	"insufficient role":                     "Недостаточно прав для этого действия.",
	"mailer not configured":                 "Сервис отправки почты не настроен.",
	"too many requests":                     "Слишком много запросов. Попробуйте позже.",
	"email send failed":                     "Не удалось отправить письмо.",
	"email_required":                        "Укажите email.",
	"token generate failed":                 "Не удалось создать токен.",
	"token is required":                     "Требуется токен.",
	"token is invalid or expired":           "Ссылка недействительна или срок действия истек.",
	"user update failed":                    "Не удалось обновить пользователя.",
	"token update failed":                   "Не удалось обновить токен.",
	"new_email is required":                 "Укажите новый email.",
	"display_name is required":              "Укажите имя профиля.",
	"display_name is too short":             "Имя профиля слишком короткое.",
	"display_name is too long":              "Имя профиля слишком длинное.",
	"display_name has invalid characters":   "Имя профиля содержит недопустимые символы.",
	"display_name is not allowed":           "Это имя профиля недопустимо.",
	"current_password is required":          "Укажите текущий пароль.",
	"no_local_password":                     "Для аккаунта не задан локальный пароль.",
	"email already in use":                  "Этот email уже используется.",
	"new_password must be at least 8 chars": "Новый пароль должен быть не короче 8 символов.",
	"state create failed":                   "Не удалось создать состояние авторизации.",
	"flow must be login or link":            "Параметр flow должен быть login или link.",
}

func localizeAuthErrorMessage(message string) string {
	if translated, ok := authErrorMessageRu[message]; ok {
		return translated
	}
	return message
}
