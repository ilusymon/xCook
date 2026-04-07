package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"xcook/backend/internal/model"
)

type FunctionService struct {
	db *gorm.DB
}

type getDishDetailInput struct {
	DishID string `json:"dishId"`
}

type deleteDishInput struct {
	DishID string `json:"dishId"`
}

type placeOrderInput struct {
	Items []model.OrderItem `json:"items"`
	Note  string            `json:"note"`
}

type getOrdersInput struct {
	Role     string `json:"role"`
	Status   string `json:"status"`
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	OrderID  string `json:"orderId"`
}

type updateOrderStatusInput struct {
	OrderID   string `json:"orderId"`
	NewStatus string `json:"newStatus"`
}

type saveDishInput struct {
	Dish map[string]any `json:"dish"`
}

type saveCategoryInput struct {
	Action     string         `json:"action"`
	Category   map[string]any `json:"category"`
	CategoryID string         `json:"categoryId"`
}

type adjustStarCoinsInput struct {
	TargetUserID string `json:"targetUserId"`
	Amount       int64  `json:"amount"`
	Reason       string `json:"reason"`
}

var defaultCategories = []model.Category{
	{Name: "荤菜", Icon: "meat", SortOrder: 1, IsActive: true},
	{Name: "素菜", Icon: "vegetable", SortOrder: 2, IsActive: true},
	{Name: "汤品", Icon: "soup", SortOrder: 3, IsActive: true},
	{Name: "主食", Icon: "staple", SortOrder: 4, IsActive: true},
	{Name: "甜品", Icon: "dessert", SortOrder: 5, IsActive: true},
	{Name: "饮品", Icon: "drink", SortOrder: 6, IsActive: true},
}

var validTransitions = map[string][]string{
	"placed":   {"accepted", "cancelled"},
	"accepted": {"cooking", "cancelled"},
	"cooking":  {"done"},
}

func NewFunctionService(db *gorm.DB) *FunctionService {
	return &FunctionService{db: db}
}

func (s *FunctionService) Dispatch(ctx context.Context, openID, name string, payload map[string]any) (any, error) {
	switch name {
	case "getUserInfo":
		return s.GetUserInfo(ctx, openID)
	case "getMenu":
		role, _ := payload["role"].(string)
		return s.GetMenu(ctx, role)
	case "getDishDetail":
		var input getDishDetailInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("dishId 参数错误")
		}
		return s.GetDishDetail(ctx, input.DishID)
	case "saveDish":
		var input saveDishInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("dish 参数错误")
		}
		return s.SaveDish(ctx, openID, input.Dish)
	case "deleteDish":
		var input deleteDishInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("dishId 参数错误")
		}
		return s.DeleteDish(ctx, input.DishID)
	case "placeOrder":
		var input placeOrderInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("订单参数错误")
		}
		return s.PlaceOrder(ctx, openID, input.Items, input.Note)
	case "getOrders":
		var input getOrdersInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("查询参数错误")
		}
		return s.GetOrders(ctx, openID, input)
	case "updateOrderStatus":
		var input updateOrderStatusInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("状态参数错误")
		}
		return s.UpdateOrderStatus(ctx, openID, input.OrderID, input.NewStatus)
	case "adjustStarCoins":
		var input adjustStarCoinsInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("星星币参数错误")
		}
		return s.AdjustStarCoins(ctx, openID, input.TargetUserID, input.Amount, input.Reason)
	case "initCategories":
		return s.InitCategories(ctx)
	case "saveCategory":
		var input saveCategoryInput
		if err := decodePayload(payload, &input); err != nil {
			return nil, badRequest("分类参数错误")
		}
		return s.SaveCategory(ctx, input.Action, input.Category, input.CategoryID)
	default:
		return nil, notFound("未找到对应函数")
	}
}

func (s *FunctionService) GetUserInfo(ctx context.Context, openID string) (*model.User, error) {
	if openID == "" {
		return nil, unauthorized("未登录")
	}

	var user model.User
	err := s.db.WithContext(ctx).Where("openid = ?", openID).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	now := time.Now()
	user = model.User{
		ID:        openID,
		OpenID:    openID,
		Role:      "both",
		StarCoins: 100,
		CoinLog: []model.CoinLogEntry{
			{Type: "credit", Amount: 100, Reason: "初始赠送", Timestamp: now},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *FunctionService) GetMenu(ctx context.Context, role string) (map[string]any, error) {
	var categories []model.Category
	if err := s.db.WithContext(ctx).
		Where("is_active = ?", true).
		Order("sort_order asc").
		Find(&categories).Error; err != nil {
		return nil, err
	}

	query := s.db.WithContext(ctx).Model(&model.Dish{}).Where("is_deleted = ?", false)
	if role != "chef" {
		query = query.Where("is_available = ?", true)
	}

	var dishes []model.Dish
	if err := query.Order("created_at desc").Limit(100).Find(&dishes).Error; err != nil {
		return nil, err
	}

	dishMap := make(map[string][]model.Dish, len(categories))
	for _, category := range categories {
		dishMap[category.ID] = []model.Dish{}
	}
	for _, dish := range dishes {
		if _, ok := dishMap[dish.CategoryID]; ok {
			dishMap[dish.CategoryID] = append(dishMap[dish.CategoryID], dish)
		}
	}

	return map[string]any{
		"categories": categories,
		"dishes":     dishMap,
	}, nil
}

func (s *FunctionService) GetDishDetail(ctx context.Context, dishID string) (*model.Dish, error) {
	if dishID == "" {
		return nil, nil
	}

	var dish model.Dish
	if err := s.db.WithContext(ctx).First(&dish, "id = ?", dishID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &dish, nil
}

func (s *FunctionService) SaveDish(ctx context.Context, openID string, input map[string]any) (map[string]any, error) {
	now := time.Now()
	dishID := stringValue(input["_id"])
	if dishID != "" {
		var dish model.Dish
		if err := s.db.WithContext(ctx).First(&dish, "id = ?", dishID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, notFound("菜品不存在")
			}
			return nil, err
		}

		if err := applyDishPatch(&dish, input); err != nil {
			return nil, badRequest("菜品参数错误")
		}
		if strings.TrimSpace(dish.Name) == "" {
			return nil, badRequest("缺少菜品名称")
		}
		if strings.TrimSpace(dish.CategoryID) == "" {
			return nil, badRequest("缺少分类")
		}
		dish.UpdatedAt = now
		if err := s.db.WithContext(ctx).Save(&dish).Error; err != nil {
			return nil, err
		}

		return map[string]any{"success": true, "dishId": dish.ID}, nil
	}

	dish := model.Dish{
		ID:        uuid.NewString(),
		IsDeleted: false,
		CreatedBy: openID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := applyDishPatch(&dish, input); err != nil {
		return nil, badRequest("菜品参数错误")
	}
	if strings.TrimSpace(dish.Name) == "" {
		return nil, badRequest("缺少菜品名称")
	}
	if strings.TrimSpace(dish.CategoryID) == "" {
		return nil, badRequest("缺少分类")
	}
	if dish.Difficulty == 0 {
		dish.Difficulty = 1
	}
	if _, ok := input["isAvailable"]; !ok {
		dish.IsAvailable = true
	}

	if err := s.db.WithContext(ctx).Create(&dish).Error; err != nil {
		return nil, err
	}

	return map[string]any{"success": true, "dishId": dish.ID}, nil
}

func (s *FunctionService) DeleteDish(ctx context.Context, dishID string) (map[string]any, error) {
	if dishID == "" {
		return nil, badRequest("缺少菜品ID")
	}

	if err := s.db.WithContext(ctx).Model(&model.Dish{}).
		Where("id = ?", dishID).
		Updates(map[string]any{
			"is_deleted": true,
			"updated_at": time.Now(),
		}).Error; err != nil {
		return nil, err
	}

	return map[string]any{"success": true}, nil
}

func (s *FunctionService) PlaceOrder(ctx context.Context, openID string, items []model.OrderItem, note string) (map[string]any, error) {
	if len(items) == 0 {
		return nil, badRequest("购物车为空")
	}

	var response map[string]any
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", openID).
			First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return notFound("用户不存在")
			}
			return err
		}

		totalPrice := int64(0)
		totalCalories := int64(0)
		verifiedItems := make([]model.OrderItem, 0, len(items))

		for _, item := range items {
			var dish model.Dish
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ?", item.DishID).
				First(&dish).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return badRequest("菜品不存在")
				}
				return err
			}

			if dish.IsDeleted || !dish.IsAvailable {
				return badRequest(fmt.Sprintf("菜品「%s」已下架", item.DishName))
			}

			extraPrice := calculateExtraPrice(dish.OptionGroups, item.SelectedOptions)
			itemTotal := (dish.Price + extraPrice) * int64(item.Quantity)
			totalPrice += itemTotal
			totalCalories += dish.Calories * int64(item.Quantity)

			verifiedItems = append(verifiedItems, model.OrderItem{
				DishID:          dish.ID,
				DishName:        dish.Name,
				CoverImage:      dish.CoverImage,
				UnitPrice:       dish.Price,
				Quantity:        item.Quantity,
				SelectedOptions: item.SelectedOptions,
				ExtraPrice:      extraPrice,
				ItemTotal:       itemTotal,
				Calories:        dish.Calories,
			})
		}

		if user.StarCoins < totalPrice {
			return badRequest("星星币不足")
		}

		now := time.Now()
		order := model.Order{
			ID:            uuid.NewString(),
			OrderNumber:   generateOrderNumber(now),
			UserID:        openID,
			Status:        "placed",
			Items:         verifiedItems,
			TotalPrice:    totalPrice,
			TotalCalories: totalCalories,
			Note:          strings.TrimSpace(note),
			StatusHistory: []model.StatusHistoryEntry{
				{Status: "placed", Timestamp: now, By: openID},
			},
			CreatedAt: now,
			UpdatedAt: now,
		}

		user.StarCoins -= totalPrice
		user.CoinLog = append(user.CoinLog, model.CoinLogEntry{
			Type:      "debit",
			Amount:    totalPrice,
			Reason:    fmt.Sprintf("订单 %s", order.OrderNumber),
			OrderID:   order.ID,
			Timestamp: now,
		})
		user.UpdatedAt = now

		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		response = map[string]any{
			"success":        true,
			"orderId":        order.ID,
			"orderNumber":    order.OrderNumber,
			"remainingCoins": user.StarCoins,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *FunctionService) GetOrders(ctx context.Context, openID string, input getOrdersInput) (map[string]any, error) {
	if input.OrderID != "" {
		var order model.Order
		if err := s.db.WithContext(ctx).First(&order, "id = ?", input.OrderID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return map[string]any{"order": nil}, nil
			}
			return nil, err
		}
		return map[string]any{"order": order}, nil
	}

	page := input.Page
	if page <= 0 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}

	query := s.db.WithContext(ctx).Model(&model.Order{})
	if input.Role != "chef" {
		query = query.Where("user_id = ?", openID)
	}

	switch input.Status {
	case "active":
		query = query.Where("status IN ?", []string{"placed", "accepted", "cooking"})
	case "done":
		query = query.Where("status = ?", "done")
	case "placed":
		query = query.Where("status = ?", "placed")
	case "cooking":
		query = query.Where("status IN ?", []string{"accepted", "cooking"})
	case "":
	default:
		query = query.Where("status = ?", input.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	skip := (page - 1) * pageSize
	var orders []model.Order
	if err := query.Order("created_at desc").Offset(skip).Limit(pageSize).Find(&orders).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"orders":  orders,
		"total":   total,
		"hasMore": int64(skip+len(orders)) < total,
	}, nil
}

func (s *FunctionService) UpdateOrderStatus(ctx context.Context, openID, orderID, newStatus string) (map[string]any, error) {
	if orderID == "" || newStatus == "" {
		return nil, badRequest("参数不完整")
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&order, "id = ?", orderID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return badRequest("订单不存在")
			}
			return err
		}

		allowed := validTransitions[order.Status]
		if !contains(allowed, newStatus) {
			return badRequest(fmt.Sprintf("不能从 %s 转为 %s", order.Status, newStatus))
		}

		now := time.Now()
		order.Status = newStatus
		order.StatusHistory = append(order.StatusHistory, model.StatusHistoryEntry{
			Status:    newStatus,
			Timestamp: now,
			By:        openID,
		})
		order.UpdatedAt = now

		if err := tx.Save(&order).Error; err != nil {
			return err
		}

		if newStatus == "cancelled" {
			var user model.User
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				First(&user, "id = ?", order.UserID).Error; err != nil {
				return err
			}

			user.StarCoins += order.TotalPrice
			user.CoinLog = append(user.CoinLog, model.CoinLogEntry{
				Type:      "credit",
				Amount:    order.TotalPrice,
				Reason:    fmt.Sprintf("订单 %s 取消退回", order.OrderNumber),
				OrderID:   order.ID,
				Timestamp: now,
			})
			user.UpdatedAt = now

			if err := tx.Save(&user).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{"success": true}, nil
}

func (s *FunctionService) AdjustStarCoins(ctx context.Context, openID, targetUserID string, amount int64, reason string) (map[string]any, error) {
	if targetUserID == "" || amount == 0 {
		return nil, badRequest("参数不完整")
	}

	var user model.User
	if err := s.db.WithContext(ctx).First(&user, "id = ?", targetUserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, notFound("用户不存在")
		}
		return nil, err
	}

	entryType := "debit"
	if amount > 0 {
		entryType = "credit"
	}
	if reason == "" {
		if amount > 0 {
			reason = "伴侣赠送"
		} else {
			reason = "扣除"
		}
	}

	user.StarCoins += amount
	user.CoinLog = append(user.CoinLog, model.CoinLogEntry{
		Type:      entryType,
		Amount:    abs(amount),
		Reason:    reason,
		By:        openID,
		Timestamp: time.Now(),
	})
	user.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(&user).Error; err != nil {
		return nil, err
	}

	return map[string]any{"success": true}, nil
}

func (s *FunctionService) InitCategories(ctx context.Context) (map[string]any, error) {
	var total int64
	if err := s.db.WithContext(ctx).Model(&model.Category{}).Count(&total).Error; err != nil {
		return nil, err
	}
	if total > 0 {
		return map[string]any{"success": true, "message": "分类已存在，跳过初始化"}, nil
	}

	now := time.Now()
	categories := make([]model.Category, 0, len(defaultCategories))
	for _, category := range defaultCategories {
		category.ID = uuid.NewString()
		category.CreatedAt = now
		category.UpdatedAt = now
		categories = append(categories, category)
	}

	if err := s.db.WithContext(ctx).Create(&categories).Error; err != nil {
		return nil, err
	}

	return map[string]any{"success": true, "message": fmt.Sprintf("已初始化 %d 个分类", len(categories))}, nil
}

func (s *FunctionService) SaveCategory(ctx context.Context, action string, category map[string]any, categoryID string) (map[string]any, error) {
	if action == "delete" {
		if categoryID == "" {
			return nil, badRequest("缺少分类ID")
		}

		var total int64
		if err := s.db.WithContext(ctx).Model(&model.Dish{}).
			Where("category_id = ? AND is_deleted = ?", categoryID, false).
			Count(&total).Error; err != nil {
			return nil, err
		}
		if total > 0 {
			return map[string]any{
				"success": false,
				"message": fmt.Sprintf("该分类下还有 %d 道菜品，请先移除", total),
			}, nil
		}

		if err := s.db.WithContext(ctx).Delete(&model.Category{}, "id = ?", categoryID).Error; err != nil {
			return nil, err
		}
		return map[string]any{"success": true}, nil
	}

	now := time.Now()
	inputID := stringValue(category["_id"])
	if inputID != "" {
		var existing model.Category
		if err := s.db.WithContext(ctx).First(&existing, "id = ?", inputID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, notFound("分类不存在")
			}
			return nil, err
		}

		if err := applyCategoryPatch(&existing, category); err != nil {
			return nil, badRequest("分类参数错误")
		}
		existing.UpdatedAt = now

		if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
			return nil, err
		}

		return map[string]any{"success": true, "id": existing.ID}, nil
	}

	var last model.Category
	nextSort := 1
	if err := s.db.WithContext(ctx).Order("sort_order desc").First(&last).Error; err == nil {
		nextSort = last.SortOrder + 1
	} else if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	created := model.Category{
		ID:        uuid.NewString(),
		SortOrder: nextSort,
		Name:      "新分类",
		Icon:      "default",
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := applyCategoryPatch(&created, category); err != nil {
		return nil, badRequest("分类参数错误")
	}

	if err := s.db.WithContext(ctx).Create(&created).Error; err != nil {
		return nil, err
	}

	return map[string]any{"success": true, "id": created.ID}, nil
}

func decodePayload(payload map[string]any, target any) error {
	if len(payload) == 0 {
		return nil
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, target)
}

func applyDishPatch(dst *model.Dish, input map[string]any) error {
	var partial model.Dish
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, &partial); err != nil {
		return err
	}

	if _, ok := input["name"]; ok {
		dst.Name = strings.TrimSpace(partial.Name)
	}
	if _, ok := input["description"]; ok {
		dst.Description = strings.TrimSpace(partial.Description)
	}
	if _, ok := input["coverImage"]; ok {
		dst.CoverImage = partial.CoverImage
	}
	if _, ok := input["categoryId"]; ok {
		dst.CategoryID = partial.CategoryID
	}
	if _, ok := input["price"]; ok {
		dst.Price = partial.Price
	}
	if _, ok := input["calories"]; ok {
		dst.Calories = partial.Calories
	}
	if _, ok := input["preparationTime"]; ok {
		dst.PreparationTime = partial.PreparationTime
	}
	if _, ok := input["difficulty"]; ok {
		dst.Difficulty = partial.Difficulty
	}
	if _, ok := input["isAvailable"]; ok {
		dst.IsAvailable = partial.IsAvailable
	}
	if _, ok := input["optionGroups"]; ok {
		dst.OptionGroups = partial.OptionGroups
	}
	if _, ok := input["materials"]; ok {
		dst.Materials = partial.Materials
	}
	if _, ok := input["steps"]; ok {
		dst.Steps = partial.Steps
	}
	if _, ok := input["videoUrl"]; ok {
		dst.VideoURL = strings.TrimSpace(partial.VideoURL)
	}

	return nil
}

func applyCategoryPatch(dst *model.Category, input map[string]any) error {
	var partial model.Category
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, &partial); err != nil {
		return err
	}

	if _, ok := input["name"]; ok {
		dst.Name = defaultString(partial.Name, dst.Name)
	}
	if _, ok := input["icon"]; ok {
		dst.Icon = defaultString(partial.Icon, dst.Icon)
	}
	if _, ok := input["sortOrder"]; ok {
		dst.SortOrder = partial.SortOrder
	}
	if _, ok := input["isActive"]; ok {
		dst.IsActive = partial.IsActive
	}

	return nil
}

func calculateExtraPrice(groups []model.OptionGroup, selected map[string][]string) int64 {
	var extraPrice int64
	for _, group := range groups {
		values := selected[group.GroupName]
		if len(values) == 0 {
			continue
		}
		for _, option := range group.Options {
			if contains(values, option.Value) || contains(values, option.Label) {
				extraPrice += option.ExtraPrice
			}
		}
	}
	return extraPrice
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func abs(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func stringValue(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func generateOrderNumber(now time.Time) string {
	return fmt.Sprintf(
		"XC%04d%02d%02d%04d",
		now.Year(),
		now.Month(),
		now.Day(),
		rand.IntN(10000),
	)
}
