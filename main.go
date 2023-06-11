package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	log15 "github.com/inconshreveable/log15"
	mail "github.com/xhit/go-simple-mail/v2"
)

type Config struct {
	URL       string `json:"url"`
	Frequency int    `json:"frequency"`
	Email     struct {
		Server struct {
			Hostname string `json:"hostname"`
			Port     int    `json:"port"`
			Auth     struct {
				Username string `json:"username"`
				Password string `json:"password"`
			} `json:"auth"`
			TLS bool `json:"tls"`
		} `json:"server"`
		From struct {
			Name    string `json:"name"`
			Address string `json:"address"`
		} `json:"from"`
		To []struct {
			Name    string `json:"name"`
			Address string `json:"address"`
		} `json:"to"`
		Subject string `json:"subject"`
		Body    string `json:"body"`
	} `json:"email"`
}

type Service struct {
	Log        log15.Logger
	Config     Config
	MailServer *mail.SMTPServer
	Snapshot   string
}

var s Service

func (s *Service) Boot() error {
	logger := log15.New("service", "compulsive")
	logger.SetHandler(log15.MultiHandler(
		log15.StreamHandler(os.Stdout, log15.LogfmtFormat()),
		log15.LvlFilterHandler(log15.LvlInfo, log15.Must.FileHandler("log.json", log15.JsonFormat()))),
	)

	s.Log = logger

	configFile, err := os.ReadFile("./compulsive.json")
	if err != nil {
		return fmt.Errorf("reading config file: %w", err)
	}

	err = json.Unmarshal(configFile, &s.Config)
	if err != nil {
		return fmt.Errorf("parsing config file: %w", err)
	}

	s.MailServer = mail.NewSMTPClient()
	s.MailServer.Host = s.Config.Email.Server.Hostname
	s.MailServer.Port = s.Config.Email.Server.Port
	s.MailServer.Username = s.Config.Email.Server.Auth.Username
	s.MailServer.Password = s.Config.Email.Server.Auth.Password
	if s.Config.Email.Server.TLS {
		s.MailServer.Encryption = mail.EncryptionTLS
	}

	return nil

}

var tpl = template.Must(template.New("emailBody").Parse(`
<html>
<head>
   <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
   <title>{{ .subject }}</title>
</head>
<body>
   <p>{{ .body }}</p>
</body>
</html>
	`))

func main() {
	err := s.Boot()
	if err != nil {
		log.Fatal("initializing service", err)
	}

	s.Log.Info("starting")
	html, err := fetch()
	if err != nil {
		s.Log.Error("failed to fetch initial snapshot", "err", err)
		os.Exit(1)
	}

	isFetching := false
	s.Snapshot = html

	freq := s.Config.Frequency
	if freq < 5 {
		freq = 5
	}

	c := time.Tick(time.Second * time.Duration(freq))
	for range c {
		s.Log.Info("starting a check")
		if isFetching {
			s.Log.Warn("already locked, skipping")
			// skipping
			return
		}

		isFetching = true

		s.Log.Debug("fetching...")
		out, err := fetch()

		if err != nil {
			s.Log.Error("fetching snapshot", "err", err)
			isFetching = false
		}

		if out != s.Snapshot {
			s.Log.Info("snapshot differs from fetched data. Page changed.")

			// send mail
			s.Log.Info("sending mail")
			err := sendMail()
			if err != nil {
				s.Log.Error("sending email", "err", err)
			}

			// update snapshot
			s.Log.Info("updating snapshot")
			s.Snapshot = out
		} else {
			s.Log.Debug("no change detected. All clear.")
		}

		// release lock
		s.Log.Debug("releasing lock")
		isFetching = false
	}

}

func fetch() (string, error) {
	req, err := http.NewRequest("GET", s.Config.URL, nil)
	if err != nil {
		return "", err
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

func sendMail() error {
	smtpClient, err := s.MailServer.Connect()
	if err != nil {
		return fmt.Errorf("connecting to SMTP server: %w", err)
	}
	defer smtpClient.Close()

	// Create email
	email := mail.NewMSG()
	email.SetFrom(fmt.Sprintf("%s <%s>", s.Config.Email.From.Name, s.Config.Email.From.Address))
	for _, to := range s.Config.Email.To {
		email.AddTo(to.Address)
	}

	email.SetSubject(s.Config.Email.Subject)

	b := new(bytes.Buffer)
	tpl.Execute(b, map[string]any{
		"subject": s.Config.Email.Subject,
		"body":    s.Config.Email.Body,
	})
	email.SetBody(mail.TextHTML, b.String())

	// Send email
	err = email.Send(smtpClient)
	if err != nil {
		return fmt.Errorf("sending email: %w", err)
	}

	return nil
}
