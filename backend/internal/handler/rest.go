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

type updateOrderStatusRequest struct {
	Status string `json:"status"`
}

type updateWishlistDishProgressRequest struct {
	Action string `json:"action"`
}

type createFoodRecordRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Tag         string `json:"tag"`
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

func (h *RestHandler) ListCategories(c *gin.Context) {
	categories, err := h.functionService.GetCategories(c.Request.Context())
	h.respond(c, gin.H{"categories": categories}, err)
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
		OrderID: parseUintParam(c.Param("id")),
		Role:    c.Query("role"),
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

func (h *RestHandler) ListWishlists(c *gin.Context) {
	page, _ := strconv.Atoi(withDefault(c.Query("page"), "1"))
	pageSize, _ := strconv.Atoi(withDefault(c.Query("pageSize"), "10"))
	result, err := h.functionService.ListWishlists(c.Request.Context(), middleware.OpenIDFromContext(c), service.GetOrdersInput{
		Role:     c.Query("role"),
		Status:   c.Query("status"),
		Page:     page,
		PageSize: pageSize,
	})
	h.respond(c, result, err)
}

func (h *RestHandler) GetWishlist(c *gin.Context) {
	result, err := h.functionService.GetWishlist(c.Request.Context(), middleware.OpenIDFromContext(c), c.Param("id"), c.Query("role"))
	h.respond(c, result, err)
}

func (h *RestHandler) CreateWishlist(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	items, _ := payload["items"]
	note, _ := payload["note"].(string)
	result, err := h.functionService.CreateWishlistFromAny(c.Request.Context(), middleware.OpenIDFromContext(c), items, note)
	h.respond(c, result, err)
}

func (h *RestHandler) UpdateWishlistStatus(c *gin.Context) {
	var request updateOrderStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return
	}
	result, err := h.functionService.UpdateOrderStatus(c.Request.Context(), middleware.OpenIDFromContext(c), c.Param("id"), request.Status)
	h.respond(c, result, err)
}

func (h *RestHandler) UpdateWishlistDishProgress(c *gin.Context) {
	var request updateWishlistDishProgressRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return
	}
	itemIndex, err := strconv.Atoi(c.Param("itemIndex"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "菜品序号错误"})
		return
	}
	result, err := h.functionService.UpdateWishlistDishProgress(c.Request.Context(), middleware.OpenIDFromContext(c), c.Param("id"), itemIndex, request.Action)
	h.respond(c, result, err)
}

func (h *RestHandler) ListFoodRecords(c *gin.Context) {
	result, err := h.functionService.ListFoodRecords(c.Request.Context(), middleware.OpenIDFromContext(c), c.Query("type"))
	h.respond(c, result, err)
}

func (h *RestHandler) CreateFoodRecord(c *gin.Context) {
	var request createFoodRecordRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求体格式错误"})
		return
	}
	result, err := h.functionService.CreateFoodRecord(
		c.Request.Context(),
		middleware.OpenIDFromContext(c),
		request.Title,
		request.Description,
		request.Tag,
	)
	h.respond(c, result, err)
}

func (h *RestHandler) CreateCategory(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	result, err := h.functionService.SaveCategory(c.Request.Context(), "", payload, 0)
	h.respond(c, result, err)
}

func (h *RestHandler) UpdateCategory(c *gin.Context) {
	payload, ok := h.bindMap(c)
	if !ok {
		return
	}
	payload["_id"] = c.Param("id")
	result, err := h.functionService.SaveCategory(c.Request.Context(), "", payload, 0)
	h.respond(c, result, err)
}

func (h *RestHandler) DeleteCategory(c *gin.Context) {
	result, err := h.functionService.SaveCategory(c.Request.Context(), "delete", nil, parseUintParam(c.Param("id")))
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

func parseUintParam(value string) uint64 {
	parsed, _ := strconv.ParseUint(value, 10, 64)
	return parsed
}
