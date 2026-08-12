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
	"xcook/backend/internal/migrate"
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

	if err := migrate.Up(cfg.MySQL.MigrationDSN()); err != nil {
		return nil, err
	}

	db, err := gorm.Open(mysql.Open(cfg.MySQL.DSN()), &gorm.Config{})
	if err != nil {
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
	restHandler := handler.NewRestHandler(functionService)
	uploadHandler := handler.NewUploadHandler(minioService)

	router := gin.Default()
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.POST("/api/auth/login", authHandler.Login)

	api := router.Group("/api", middleware.AuthRequired(tokenManager))
	api.GET("/users/me", restHandler.GetCurrentUser)
	api.GET("/categories", restHandler.ListCategories)
	api.GET("/menu", restHandler.GetMenu)
	api.GET("/dishes/:id", restHandler.GetDish)
	api.POST("/dishes", restHandler.CreateDish)
	api.PUT("/dishes/:id", restHandler.UpdateDish)
	api.DELETE("/dishes/:id", restHandler.DeleteDish)
	api.GET("/orders", restHandler.ListOrders)
	api.GET("/orders/:id", restHandler.GetOrder)
	api.POST("/orders", restHandler.CreateOrder)
	api.PATCH("/orders/:id/status", restHandler.UpdateOrderStatus)
	// The wishlist is the product-facing name for a complete cooking request.
	// Legacy order routes stay available so existing clients and data remain valid.
	api.GET("/wishlists", restHandler.ListWishlists)
	api.GET("/wishlists/:id", restHandler.GetWishlist)
	api.POST("/wishlists", restHandler.CreateWishlist)
	api.PATCH("/wishlists/:id/status", restHandler.UpdateWishlistStatus)
	api.PATCH("/wishlists/:id/items/:itemIndex", restHandler.UpdateWishlistDishProgress)
	api.GET("/wishlist", restHandler.ListWishlists)
	api.GET("/wishlist/:id", restHandler.GetWishlist)
	api.POST("/wishlist", restHandler.CreateWishlist)
	api.PATCH("/wishlist/:id/status", restHandler.UpdateWishlistStatus)
	api.PATCH("/wishlist/:id/items/:itemIndex", restHandler.UpdateWishlistDishProgress)
	api.GET("/food-records", restHandler.ListFoodRecords)
	api.POST("/food-records", restHandler.CreateFoodRecord)
	api.POST("/categories", restHandler.CreateCategory)
	api.PATCH("/categories/:id", restHandler.UpdateCategory)
	api.DELETE("/categories/:id", restHandler.DeleteCategory)
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
