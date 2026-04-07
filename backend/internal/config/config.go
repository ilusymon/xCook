package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App    AppConfig
	MySQL  MySQLConfig
	MinIO  MinIOConfig
	Wechat WechatConfig
}

type AppConfig struct {
	Port        string
	JWTSecret   string
	JWTTTL      time.Duration
	ReadTimeout time.Duration
}

type MySQLConfig struct {
	Host      string
	Port      string
	User      string
	Password  string
	Database  string
	Charset   string
	ParseTime bool
	Loc       string
}

type MinIOConfig struct {
	Endpoint      string
	AccessKey     string
	SecretKey     string
	UseSSL        bool
	Bucket        string
	PublicBaseURL string
}

type WechatConfig struct {
	AppID          string
	AppSecret      string
	AllowDebugAuth bool
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		App: AppConfig{
			Port:        getEnv("APP_PORT", "8080"),
			JWTSecret:   getEnv("APP_JWT_SECRET", "xcook-dev-secret"),
			JWTTTL:      time.Duration(getEnvInt("APP_JWT_TTL_HOURS", 168)) * time.Hour,
			ReadTimeout: 15 * time.Second,
		},
		MySQL: MySQLConfig{
			Host:      getEnv("MYSQL_HOST", "127.0.0.1"),
			Port:      getEnv("MYSQL_PORT", "3306"),
			User:      getEnv("MYSQL_USER", "root"),
			Password:  getEnv("MYSQL_PASSWORD", "123456"),
			Database:  getEnv("MYSQL_DATABASE", "xcook"),
			Charset:   getEnv("MYSQL_CHARSET", "utf8mb4"),
			ParseTime: getEnvBool("MYSQL_PARSE_TIME", true),
			Loc:       getEnv("MYSQL_LOC", "Local"),
		},
		MinIO: MinIOConfig{
			Endpoint:      getEnv("MINIO_ENDPOINT", "127.0.0.1:9000"),
			AccessKey:     getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey:     getEnv("MINIO_SECRET_KEY", "minioadmin"),
			UseSSL:        getEnvBool("MINIO_USE_SSL", false),
			Bucket:        getEnv("MINIO_BUCKET", "xcook-images"),
			PublicBaseURL: getEnv("MINIO_PUBLIC_BASE_URL", "http://127.0.0.1:9000"),
		},
		Wechat: WechatConfig{
			AppID:          getEnv("WECHAT_APP_ID", ""),
			AppSecret:      getEnv("WECHAT_APP_SECRET", ""),
			AllowDebugAuth: getEnvBool("WECHAT_ALLOW_DEBUG_AUTH", true),
		},
	}
}

func (c MySQLConfig) DSN() string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=%t&loc=%s",
		c.User,
		c.Password,
		c.Host,
		c.Port,
		c.Database,
		c.Charset,
		c.ParseTime,
		c.Loc,
	)
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
