package app

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"xcook/backend/internal/auth"
	"xcook/backend/internal/config"
	"xcook/backend/internal/handler"
	"xcook/backend/internal/middleware"
	"xcook/backend/internal/model"
	"xcook/backend/internal/service"
	"xcook/backend/internal/storage"
	"xcook/backend/internal/wechat"
)

type App struct {
	config config.Config
	router *gin.Engine
}

func New() (*App, error) {
	cfg := config.Load()

	db, err := gorm.Open(mysql.Open(cfg.MySQL.DSN()), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Category{},
		&model.Dish{},
		&model.Order{},
	); err != nil {
		return nil, err
	}

	minioService, err := storage.NewMinioService(cfg.MinIO)
	if err != nil {
		return nil, err
	}

	tokenManager := auth.NewTokenManager(cfg.App.JWTSecret, cfg.App.JWTTTL)
	functionService := service.NewFunctionService(db)
	wechatClient := wechat.NewClient(cfg.Wechat.AppID, cfg.Wechat.AppSecret)

	authHandler := handler.NewAuthHandler(tokenManager, wechatClient, functionService, cfg.Wechat.AllowDebugAuth)
	functionHandler := handler.NewFunctionHandler(functionService)
	uploadHandler := handler.NewUploadHandler(minioService)

	router := gin.Default()
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.POST("/api/auth/login", authHandler.Login)

	api := router.Group("/api", middleware.AuthRequired(tokenManager))
	api.POST("/functions/:name", functionHandler.Handle)
	api.POST("/uploads/images", uploadHandler.UploadImage)

	return &App{
		config: cfg,
		router: router,
	}, nil
}

func (a *App) Run() error {
	server := &http.Server{
		Addr:              ":" + a.config.App.Port,
		Handler:           a.router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	fmt.Printf("xCook backend listening on :%s\n", a.config.App.Port)
	return server.ListenAndServe()
}
