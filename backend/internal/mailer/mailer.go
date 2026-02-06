package mailer

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type Config struct {
	Host    string
	Port    int
	User    string
	Pass    string
	From    string
	ReplyTo string
	Timeout time.Duration
}

type Mailer struct {
	cfg Config
}

func New(cfg Config) *Mailer {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 10 * time.Second
	}
	return &Mailer{cfg: cfg}
}

func (m *Mailer) SendEmail(ctx context.Context, to string, subject string, textBody string, htmlBody string) error {
	if m == nil {
		return errors.New("mailer is nil")
	}
	if strings.TrimSpace(to) == "" {
		return errors.New("email to is required")
	}
	if strings.TrimSpace(m.cfg.From) == "" {
		return errors.New("email from is required")
	}

	msg, err := buildMessage(m.cfg.From, to, m.cfg.ReplyTo, subject, textBody, htmlBody)
	if err != nil {
		return err
	}

	addr := net.JoinHostPort(m.cfg.Host, fmt.Sprintf("%d", m.cfg.Port))
	dialer := net.Dialer{Timeout: m.cfg.Timeout}

	if m.cfg.Port == 465 {
		conn, err := tls.DialWithDialer(&dialer, "tcp4", addr, &tls.Config{ServerName: m.cfg.Host})
		if err != nil {
			return err
		}
		defer conn.Close()
		client, err := smtp.NewClient(conn, m.cfg.Host)
		if err != nil {
			return err
		}
		defer client.Quit()
		return sendSMTP(client, m.cfg, to, msg)
	}

	conn, err := dialer.DialContext(ctx, "tcp4", addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		return err
	}
	defer client.Quit()

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{ServerName: m.cfg.Host}
		if err := client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}

	return sendSMTP(client, m.cfg, to, msg)
}

func sendSMTP(client *smtp.Client, cfg Config, to string, msg []byte) error {
	fromAddr := cfg.From
	if parsed, err := mail.ParseAddress(cfg.From); err == nil {
		fromAddr = parsed.Address
	}

	toAddr := to
	if parsed, err := mail.ParseAddress(to); err == nil {
		toAddr = parsed.Address
	}

	if cfg.User != "" && cfg.Pass != "" {
		auth := smtp.PlainAuth("", cfg.User, cfg.Pass, cfg.Host)
		if err := client.Auth(auth); err != nil {
			return err
		}
	}

	if err := client.Mail(fromAddr); err != nil {
		return err
	}
	if err := client.Rcpt(toAddr); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

func buildMessage(from, to, replyTo, subject, textBody, htmlBody string) ([]byte, error) {
	boundary := fmt.Sprintf("multipart-%d", time.Now().UnixNano())
	date := time.Now().UTC().Format(time.RFC1123Z)
	messageID := fmt.Sprintf("<%d.%s>", time.Now().UnixNano(), strings.ReplaceAll(from, "@", "."))

	headers := []string{
		fmt.Sprintf("From: %s", from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", encodeHeader(subject)),
		fmt.Sprintf("Date: %s", date),
		fmt.Sprintf("Message-ID: %s", messageID),
		"MIME-Version: 1.0",
		fmt.Sprintf("Content-Type: multipart/alternative; boundary=%s", boundary),
	}
	if strings.TrimSpace(replyTo) != "" {
		headers = append(headers, fmt.Sprintf("Reply-To: %s", replyTo))
	}

	var sb strings.Builder
	for _, h := range headers {
		sb.WriteString(h)
		sb.WriteString("\r\n")
	}
	sb.WriteString("\r\n")

	sb.WriteString("--" + boundary + "\r\n")
	sb.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	sb.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	sb.WriteString(textBody)
	sb.WriteString("\r\n")

	sb.WriteString("--" + boundary + "\r\n")
	sb.WriteString("Content-Type: text/html; charset=utf-8\r\n")
	sb.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	sb.WriteString(htmlBody)
	sb.WriteString("\r\n")

	sb.WriteString("--" + boundary + "--\r\n")
	return []byte(sb.String()), nil
}

func encodeHeader(value string) string {
	if value == "" {
		return ""
	}
	return fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(value)))
}
