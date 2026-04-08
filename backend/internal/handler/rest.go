package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"xcook/backend/internal/middleware"
	"xcook/backend/internal/service"
)

type RestHandler struct {
	functionService *service.FunctionService
}

type createOrderRequest struct {
	Items any    `json:"items"`
	Note  string `json:"note"`
}

type updateOrderStatusRequest struct {
	Status string `json:"status"`
}

type adjustStarCoinsRequest struct {
	Amount int64  `json:"amount"`
	Reason string `json:"reason"`
}

func NewRestHandler(functionService *service.FunctionService) *RestHandler {
	return &RestHandler{functionService: functionService}
}

func (h *RestHandler) GetCurrentUser(c *gin.Context) {
	result, err := h.functionService.GetUserInfo(c.Request.Context(), middleware.OpenIDFromContext(c))
	h.respond(c, result, err)
}

func (h *RestHandler) GetMenu(c *gin.Context) {
	result, err := h.functionService.GetMenu(c.Request.Context(), c.Query("role"))
	h.respond(c, result, err)
}

func (h *RestHandler) GetDish(c *gin.Context) {
	result, err := h.functionService.GetDishDetail(c.Request.Context(), c.Param("id"))
	h.respond(c, result, err)
}

func (h *RestHandler) CreateDish(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	result, err := h.functionService.SaveDish(c.Request.Context(), middleware.OpenIDFromContext(c), payload)
	h.respond(c, result, err)
}

func (h *RestHandler) UpdateDish(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	payload["_id"] = c.Param("id")
	result, err := h.functionService.SaveDish(c.Request.Context(), middleware.OpenIDFromContext(c), payload)
	h.respond(c, result, err)
}

func (h *RestHandler) DeleteDish(c *gin.Context) {
	result, err := h.functionService.DeleteDish(c.Request.Context(), c.Param("id"))
	h.respond(c, result, err)
}

func (h *RestHandler) CreateOrder(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}

	items, _ := payload["items"]
	note, _ := payload["note"].(string)
	result, err := h.functionService.PlaceOrderFromAny(
		c.Request.Context(),
		middleware.OpenIDFromContext(c),
		items,
		note,
	)
	h.respond(c, result, err)
}

func (h *RestHandler) ListOrders(c *gin.Context) {
	page, _ := strconv.Atoi(withDefault(c.Query("page"), "1"))
	pageSize, _ := strconv.Atoi(withDefault(c.Query("pageSize"), "10"))
	result, err := h.functionService.GetOrders(c.Request.Context(), middleware.OpenIDFromContext(c), service.GetOrdersInput{
		Role:     c.Query("role"),
		Status:   c.Query("status"),
		Page:     page,
		PageSize: pageSize,
	})
	h.respond(c, result, err)
}

func (h *RestHandler) GetOrder(c *gin.Context) {
	result, err := h.functionService.GetOrders(c.Request.Context(), middleware.OpenIDFromContext(c), service.GetOrdersInput{
		OrderID: c.Param("id"),
	})
	h.respond(c, result, err)
}

func (h *RestHandler) UpdateOrderStatus(c *gin.Context) {
	var request updateOrderStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return
	}
	result, err := h.functionService.UpdateOrderStatus(
		c.Request.Context(),
		middleware.OpenIDFromContext(c),
		c.Param("id"),
		request.Status,
	)
	h.respond(c, result, err)
}

func (h *RestHandler) CreateCategory(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	result, err := h.functionService.SaveCategory(c.Request.Context(), "", payload, "")
	h.respond(c, result, err)
}

func (h *RestHandler) UpdateCategory(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	payload["_id"] = c.Param("id")
	result, err := h.functionService.SaveCategory(c.Request.Context(), "", payload, "")
	h.respond(c, result, err)
}

func (h *RestHandler) DeleteCategory(c *gin.Context) {
	result, err := h.functionService.SaveCategory(c.Request.Context(), "delete", nil, c.Param("id"))
	h.respond(c, result, err)
}

func (h *RestHandler) AdjustStarCoins(c *gin.Context) {
	var request adjustStarCoinsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return
	}
	result, err := h.functionService.AdjustStarCoins(
		c.Request.Context(),
		middleware.OpenIDFromContext(c),
		c.Param("id"),
		request.Amount,
		request.Reason,
	)
	h.respond(c, result, err)
}

func (h *RestHandler) bindMap(c *gin.Context) (map[string]any, bool) {
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return nil, false
	}
	return payload, true
}

func (h *RestHandler) respond(c *gin.Context, result any, err error) {
	if err != nil {
		var serviceErr *service.ServiceError
		if errors.As(err, &serviceErr) {
			c.JSON(serviceErr.Status, gin.H{"message": serviceErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func withDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
