package wechat

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type Client struct {
	appID      string
	appSecret  string
	httpClient *http.Client
}

type code2SessionResponse struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

func NewClient(appID, appSecret string) *Client {
	return &Client{
		appID:     appID,
		appSecret: appSecret,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) Code2Session(ctx context.Context, code string) (string, error) {
	if c.appID == "" || c.appSecret == "" {
		return "", fmt.Errorf("wechat app credentials are not configured")
	}
	if code == "" {
		return "", fmt.Errorf("login code is required")
	}

	endpoint := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		url.QueryEscape(c.appID),
		url.QueryEscape(c.appSecret),
		url.QueryEscape(code),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var payload code2SessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}

	if payload.ErrCode != 0 {
		return "", fmt.Errorf("wechat login failed: %s", payload.ErrMsg)
	}
	if payload.OpenID == "" {
		return "", fmt.Errorf("wechat login returned empty openid")
	}

	return payload.OpenID, nil
}
