package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand/v2"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"xcook/backend/internal/model"
)

type FunctionService struct {
	db *gorm.DB
}

type getDishDetailInput struct {
	DishID uint64 `json:"dishId"`
}

type deleteDishInput struct {
	DishID uint64 `json:"dishId"`
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
	OrderID  uint64 `json:"orderId"`
}

type GetOrdersInput = getOrdersInput

type updateOrderStatusInput struct {
	OrderID   uint64 `json:"orderId"`
	NewStatus string `json:"newStatus"`
}

type saveDishInput struct {
	Dish map[string]any `json:"dish"`
}

type saveCategoryInput struct {
	Action     string         `json:"action"`
	Category   map[string]any `json:"category"`
	CategoryID uint64         `json:"categoryId"`
}

type foodRecordView struct {
	ID          string    `json:"_id"`
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CoverImage  string    `json:"coverImage"`
	Tag         string    `json:"tag"`
	Status      string    `json:"status"`
	Calories    int64     `json:"calories"`
	OccurredAt  time.Time `json:"occurredAt"`
}

var validTransitions = map[string][]string{
	"placed":   {"accepted", "cancelled"},
	"accepted": {"cooking", "cancelled"},
	"cooking":  {"done"},
}

var dailyFoodTags = map[string]bool{
	"早餐": true,
	"午餐": true,
	"晚餐": true,
	"加餐": true,
}

func NewFunctionService(db *gorm.DB) *FunctionService {
	return &FunctionService{db: db}
}

func (s *FunctionService) GetUserInfo(ctx context.Context, openID string) (*model.User, error) {
	if openID == "" {
		return nil, unauthorized("未登录")
	}

	var user model.User
	err := s.db.WithContext(ctx).Where("open_id = ?", openID).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	now := time.Now()
	user = model.User{
		OpenID:    openID,
		Role:      "both",
		CoinLog:   []model.CoinLogEntry{},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *FunctionService) GetCategories(ctx context.Context) ([]model.Category, error) {
	var categories []model.Category
	if err := s.db.WithContext(ctx).
		Where("is_active = ?", true).
		Order("sort_order asc").
		Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (s *FunctionService) UpdateUserInfo(ctx context.Context, openID, nickName string) (*model.User, error) {
	nickName = strings.TrimSpace(nickName)
	if nickName == "" || utf8.RuneCountInString(nickName) > 32 {
		return nil, badRequest("昵称须为1至32字")
	}
	user, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(user).Updates(map[string]any{"nick_name": nickName}).Error; err != nil {
		return nil, err
	}
	user.NickName = nickName
	return user, nil
}

func (s *FunctionService) validateDishCategory(ctx context.Context, dish *model.Dish) error {
	if err := validateDish(dish); err != nil {
		return err
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&model.Category{}).Where("id = ?", dish.CategoryID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return badRequest("分类不存在，请重新选择")
	}
	return nil
}

func validateDish(dish *model.Dish) error {
	if strings.TrimSpace(dish.Name) == "" || utf8.RuneCountInString(dish.Name) > 128 || dish.CategoryID == 0 {
		return badRequest("请填写菜品名称并选择分类")
	}
	if dish.Calories < 0 || dish.Calories > 100000 || dish.PreparationTime < 0 || dish.PreparationTime > 10080 || dish.Difficulty < 1 || dish.Difficulty > 3 {
		return badRequest("热量、制作时间或难度超出范围")
	}
	groupNames := make(map[string]bool)
	for _, group := range dish.OptionGroups {
		if strings.TrimSpace(group.GroupName) == "" || groupNames[group.GroupName] || !contains([]string{"single", "multi"}, group.Type) || len(group.Options) == 0 {
			return badRequest("口味组须有唯一名称、有效类型和至少一个选项")
		}
		groupNames[group.GroupName] = true
		values := make(map[string]bool)
		for _, option := range group.Options {
			if strings.TrimSpace(option.Label) == "" || strings.TrimSpace(option.Value) == "" || values[option.Value] {
				return badRequest("口味选项不能为空或重复")
			}
			values[option.Value] = true
		}
	}
	for _, material := range dish.Materials {
		if strings.TrimSpace(material.Name) == "" {
			return badRequest("请填写食材名称")
		}
	}
	for _, step := range dish.Steps {
		if strings.TrimSpace(step.Description) == "" || step.Duration < 0 {
			return badRequest("请填写步骤说明和有效时长")
		}
	}
	return nil
}

func validateSelectedOptions(groups []model.OptionGroup, selections map[string][]string) error {
	for name := range selections {
		found := false
		for _, group := range groups {
			if group.GroupName == name {
				found = true
				break
			}
		}
		if !found {
			return badRequest("口味选项已变更，请重新选菜")
		}
	}
	for _, group := range groups {
		values := selections[group.GroupName]
		if group.Required && len(values) == 0 {
			return badRequest(fmt.Sprintf("请选择%s", group.GroupName))
		}
		if group.Type == "single" && len(values) > 1 {
			return badRequest(fmt.Sprintf("%s只能单选", group.GroupName))
		}
		seen := make(map[string]bool)
		for _, value := range values {
			valid := false
			for _, option := range group.Options {
				if option.Value == value {
					valid = true
					break
				}
			}
			if !valid || seen[value] {
				return badRequest("口味选项无效，请重新选择")
			}
			seen[value] = true
		}
	}
	return nil
}

func (s *FunctionService) GetMenu(ctx context.Context, role string) (map[string]any, error) {
	var categories []model.Category
	categoryQuery := s.db.WithContext(ctx).Order("sort_order asc, id asc")
	if role != "chef" {
		categoryQuery = categoryQuery.Where("is_active = ?", true)
	}
	if err := categoryQuery.Find(&categories).Error; err != nil {
		return nil, err
	}

	query := s.db.WithContext(ctx).Model(&model.Dish{}).Where("is_deleted = ?", false)
	if role != "chef" {
		query = query.Where("is_available = ?", true)
	}

	var dishes []model.Dish
	if err := query.Order("created_at desc").Find(&dishes).Error; err != nil {
		return nil, err
	}

	dishMap := make(map[string][]model.Dish, len(categories))
	for _, category := range categories {
		dishMap[fmt.Sprintf("%d", category.ID)] = []model.Dish{}
	}
	for _, dish := range dishes {
		key := fmt.Sprintf("%d", dish.CategoryID)
		if _, ok := dishMap[key]; ok {
			dishMap[key] = append(dishMap[key], dish)
		}
	}

	return map[string]any{
		"categories": categories,
		"dishes":     dishMap,
	}, nil
}

func (s *FunctionService) GetDishDetail(ctx context.Context, dishID string) (*model.Dish, error) {
	id := uintValue(dishID)
	if id == 0 {
		return nil, badRequest("菜品ID无效")
	}

	var dish model.Dish
	if err := s.db.WithContext(ctx).First(&dish, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, notFound("菜品不存在")
		}
		return nil, err
	}

	return &dish, nil
}

func (s *FunctionService) SaveDish(ctx context.Context, openID string, input map[string]any) (map[string]any, error) {
	now := time.Now()
	dishID := uintValue(input["_id"])
	if _, updating := input["_id"]; updating && dishID == 0 {
		return nil, badRequest("菜品ID无效")
	}
	if dishID > 0 {
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
		if err := s.validateDishCategory(ctx, &dish); err != nil {
			return nil, err
		}
		dish.UpdatedAt = now
		if err := s.db.WithContext(ctx).Save(&dish).Error; err != nil {
			return nil, err
		}

		return map[string]any{"success": true, "dishId": dish.ID}, nil
	}

	dish := model.Dish{
		IsDeleted: false,
		CreatedAt: now,
		UpdatedAt: now,
	}

	currentUser, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}
	dish.CreatedBy = currentUser.ID

	if err := applyDishPatch(&dish, input); err != nil {
		return nil, badRequest("菜品参数错误")
	}
	if dish.Difficulty == 0 {
		dish.Difficulty = 1
	}
	if _, ok := input["isAvailable"]; !ok {
		dish.IsAvailable = true
	}
	if err := s.validateDishCategory(ctx, &dish); err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Create(&dish).Error; err != nil {
		return nil, err
	}

	return map[string]any{"success": true, "dishId": dish.ID}, nil
}

func (s *FunctionService) DeleteDish(ctx context.Context, dishID string) (map[string]any, error) {
	id := uintValue(dishID)
	if id == 0 {
		return nil, badRequest("缺少菜品ID")
	}

	if err := s.db.WithContext(ctx).Model(&model.Dish{}).
		Where("id = ?", id).
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
	if len(items) > 100 || utf8.RuneCountInString(note) > 200 {
		return nil, badRequest("菜品最多100项，备注最多200字")
	}
	for _, item := range items {
		if item.DishID == 0 || item.Quantity < 1 || item.Quantity > 99 {
			return nil, badRequest("每项菜品数量须为1至99份")
		}
	}

	var response map[string]any
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Where("open_id = ?", openID).
			First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return notFound("用户不存在")
			}
			return err
		}

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
				return badRequest(fmt.Sprintf("菜品「%s」已下架", dish.Name))
			}
			var category model.Category
			if err := tx.First(&category, "id = ? AND is_active = ?", dish.CategoryID, true).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return badRequest(fmt.Sprintf("菜品「%s」所在分类已停用", dish.Name))
				}
				return err
			}
			if err := validateSelectedOptions(dish.OptionGroups, item.SelectedOptions); err != nil {
				return err
			}

			totalCalories += dish.Calories * int64(item.Quantity)

			verifiedItems = append(verifiedItems, model.OrderItem{
				DishID:          dish.ID,
				DishName:        dish.Name,
				CoverImage:      dish.CoverImage,
				UnitPrice:       0,
				Quantity:        item.Quantity,
				SelectedOptions: item.SelectedOptions,
				ExtraPrice:      0,
				ItemTotal:       0,
				Calories:        dish.Calories,
				Status:          "pending",
				CurrentStep:     0,
			})
		}

		now := time.Now()
		order := model.Order{
			OrderNumber:   generateOrderNumber(now),
			UserID:        user.ID,
			Status:        "placed",
			Items:         verifiedItems,
			TotalPrice:    0,
			TotalCalories: totalCalories,
			Note:          strings.TrimSpace(note),
			StatusHistory: []model.StatusHistoryEntry{
				{Status: "placed", Timestamp: now, By: user.ID},
			},
			CreatedAt: now,
			UpdatedAt: now,
		}

		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		response = map[string]any{
			"success":        true,
			"orderId":        order.ID,
			"orderNumber":    order.OrderNumber,
			"wishlistId":     order.ID,
			"wishlistNumber": order.OrderNumber,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *FunctionService) PlaceOrderFromAny(ctx context.Context, openID string, items any, note string) (map[string]any, error) {
	parsed, err := parseOrderItems(items)
	if err != nil {
		return nil, badRequest("订单参数错误")
	}

	return s.PlaceOrder(ctx, openID, parsed, note)
}

func parseOrderItems(items any) ([]model.OrderItem, error) {
	body, err := json.Marshal(items)
	if err != nil {
		return nil, err
	}

	var rawItems []map[string]any
	if err := json.Unmarshal(body, &rawItems); err != nil {
		return nil, err
	}
	for _, item := range rawItems {
		item["dishId"] = uintValue(item["dishId"])
	}

	body, err = json.Marshal(rawItems)
	if err != nil {
		return nil, err
	}
	var parsed []model.OrderItem
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	for _, item := range parsed {
		if item.DishID == 0 || item.Quantity <= 0 {
			return nil, fmt.Errorf("invalid order item")
		}
	}
	return parsed, nil
}

func (s *FunctionService) GetOrders(ctx context.Context, openID string, input getOrdersInput) (map[string]any, error) {
	if input.OrderID != 0 {
		user, err := s.mustGetUserByOpenID(ctx, openID)
		if err != nil {
			return nil, err
		}
		query := s.db.WithContext(ctx).Where("id = ?", input.OrderID)
		if input.Role == "chef" {
			if user.Role != "chef" && user.Role != "both" {
				return nil, unauthorized("无厨师权限")
			}
		} else {
			query = query.Where("user_id = ?", user.ID)
		}
		var order model.Order
		if err := query.First(&order).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return map[string]any{"order": nil}, nil
			}
			return nil, err
		}
		normalizeWishlistOrder(&order)
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
	if input.Role == "chef" {
		user, err := s.mustGetUserByOpenID(ctx, openID)
		if err != nil {
			return nil, err
		}
		if user.Role != "chef" && user.Role != "both" {
			return nil, unauthorized("无厨师权限")
		}
	} else {
		user, err := s.mustGetUserByOpenID(ctx, openID)
		if err != nil {
			return nil, err
		}
		query = query.Where("user_id = ?", user.ID)
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
	for index := range orders {
		normalizeWishlistOrder(&orders[index])
	}

	return map[string]any{
		"orders":  orders,
		"total":   total,
		"hasMore": int64(skip+len(orders)) < total,
	}, nil
}

// CreateWishlistFromAny creates the complete cooking request that the UI calls a
// wishlist. Orders remain the storage model so existing installations keep all
// historical data and do not need a destructive table rename.
func (s *FunctionService) CreateWishlistFromAny(ctx context.Context, openID string, items any, note string) (map[string]any, error) {
	return s.PlaceOrderFromAny(ctx, openID, items, note)
}

func (s *FunctionService) ListWishlists(ctx context.Context, openID string, input getOrdersInput) (map[string]any, error) {
	result, err := s.GetOrders(ctx, openID, input)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"wishlists": result["orders"],
		"total":     result["total"],
		"hasMore":   result["hasMore"],
	}, nil
}

func (s *FunctionService) GetWishlist(ctx context.Context, openID, wishlistID, role string) (map[string]any, error) {
	if strings.TrimSpace(wishlistID) == "" {
		return nil, badRequest("缺少愿望单ID")
	}

	user, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}
	if role == "chef" && user.Role != "chef" && user.Role != "both" {
		return nil, unauthorized("无厨师权限")
	}

	query := orderQueryByIdentifier(s.db.WithContext(ctx), wishlistID)
	if role != "chef" {
		query = query.Where("user_id = ?", user.ID)
	}
	var wishlist model.Order
	if err := query.First(&wishlist).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, notFound("愿望单不存在")
		}
		return nil, err
	}
	normalizeWishlistOrder(&wishlist)
	return map[string]any{"wishlist": wishlist}, nil
}

func normalizeWishlistOrder(wishlist *model.Order) {
	for index := range wishlist.Items {
		if wishlist.Items[index].Status != "" {
			continue
		}
		switch wishlist.Status {
		case "placed":
			wishlist.Items[index].Status = "pending"
		case "accepted":
			wishlist.Items[index].Status = "accepted"
		case "cooking":
			wishlist.Items[index].Status = "cooking"
		case "done":
			wishlist.Items[index].Status = "done"
		case "cancelled":
			wishlist.Items[index].Status = "cancelled"
		}
	}
}

func (s *FunctionService) UpdateOrderStatus(ctx context.Context, openID, orderID, newStatus string) (map[string]any, error) {
	if strings.TrimSpace(orderID) == "" || newStatus == "" {
		return nil, badRequest("参数不完整")
	}

	currentUser, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order model.Order
		if err := orderQueryByIdentifier(
			tx.Clauses(clause.Locking{Strength: "UPDATE"}),
			orderID,
		).First(&order).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return badRequest("愿望单不存在")
			}
			return err
		}

		allowed := validTransitions[order.Status]
		if !contains(allowed, newStatus) {
			return badRequest(fmt.Sprintf("不能从 %s 转为 %s", order.Status, newStatus))
		}
		if newStatus == "cancelled" {
			if order.UserID != currentUser.ID {
				return unauthorized("只能取消自己的愿望单")
			}
		} else if currentUser.Role != "chef" && currentUser.Role != "both" {
			return unauthorized("无厨师权限")
		}

		now := time.Now()
		order.Status = newStatus
		for index := range order.Items {
			switch newStatus {
			case "accepted":
				if order.Items[index].Status == "" || order.Items[index].Status == "pending" {
					order.Items[index].Status = "accepted"
				}
			case "cooking":
				if order.Items[index].Status == "" || order.Items[index].Status == "accepted" {
					order.Items[index].Status = "cooking"
				}
			case "done", "cancelled":
				order.Items[index].Status = newStatus
			}
		}
		order.StatusHistory = append(order.StatusHistory, model.StatusHistoryEntry{
			Status:    newStatus,
			Timestamp: now,
			By:        currentUser.ID,
		})
		order.UpdatedAt = now

		if err := tx.Save(&order).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{"success": true}, nil
}

func (s *FunctionService) UpdateWishlistDishProgress(ctx context.Context, openID, wishlistID string, itemIndex int, action string) (map[string]any, error) {
	user, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}
	if user.Role != "chef" && user.Role != "both" {
		return nil, unauthorized("无厨师权限")
	}

	if strings.TrimSpace(wishlistID) == "" || itemIndex < 0 {
		return nil, badRequest("愿望单菜品参数错误")
	}

	var updated model.Order
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var wishlist model.Order
		if err := orderQueryByIdentifier(
			tx.Clauses(clause.Locking{Strength: "UPDATE"}),
			wishlistID,
		).First(&wishlist).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return notFound("愿望单不存在")
			}
			return err
		}
		if itemIndex >= len(wishlist.Items) {
			return badRequest("愿望单菜品不存在")
		}
		if wishlist.Status == "placed" {
			return badRequest("请先接下愿望单")
		}
		if wishlist.Status == "cancelled" || wishlist.Status == "done" {
			return badRequest("当前愿望单不能更新制作进度")
		}

		var dish model.Dish
		if err := tx.First(&dish, "id = ?", wishlist.Items[itemIndex].DishID).Error; err != nil {
			return err
		}

		normalizeWishlistOrder(&wishlist)
		if err := advanceWishlistOrderItem(&wishlist.Items[itemIndex], len(dish.Steps), action); err != nil {
			return err
		}

		previousStatus := wishlist.Status
		wishlist.Status = deriveWishlistStatus(wishlist.Items)
		now := time.Now()
		if wishlist.Status != previousStatus {
			wishlist.StatusHistory = append(wishlist.StatusHistory, model.StatusHistoryEntry{
				Status: wishlist.Status, Timestamp: now, By: user.ID,
			})
		}
		wishlist.UpdatedAt = now
		if err := tx.Save(&wishlist).Error; err != nil {
			return err
		}
		updated = wishlist
		return nil
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"success": true, "wishlist": updated}, nil
}

func advanceWishlistOrderItem(item *model.OrderItem, stepCount int, action string) error {
	switch action {
	case "start":
		if item.Status != "accepted" {
			return badRequest("当前菜品不能开始制作")
		}
		item.Status = "cooking"
		return nil
	case "next":
		if item.Status != "cooking" {
			return badRequest("当前菜品不能更新制作进度")
		}
		if stepCount == 0 || item.CurrentStep >= stepCount-1 {
			item.Status = "done"
			return nil
		}
		item.CurrentStep++
		return nil
	default:
		return badRequest("未知操作")
	}
}

func deriveWishlistStatus(items []model.OrderItem) string {
	allDone := len(items) > 0
	hasCooking := false
	for _, item := range items {
		if item.Status != "done" {
			allDone = false
		}
		if item.Status == "cooking" || item.Status == "done" {
			hasCooking = true
		}
	}
	if allDone {
		return "done"
	}
	if hasCooking {
		return "cooking"
	}
	return "accepted"
}

func (s *FunctionService) ListFoodRecords(ctx context.Context, openID, recordType string) (map[string]any, error) {
	if recordType != "" && recordType != "order" && recordType != "daily" {
		return nil, badRequest("记录类型错误")
	}
	user, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}

	records := make([]foodRecordView, 0)
	if recordType == "" || recordType == "order" {
		var wishlists []model.Order
		if err := s.db.WithContext(ctx).
			Where("user_id = ? AND status = ?", user.ID, "done").
			Find(&wishlists).Error; err != nil {
			return nil, err
		}
		for _, wishlist := range wishlists {
			for index, item := range wishlist.Items {
				records = append(records, foodRecordView{
					ID:          fmt.Sprintf("wishlist-%d-%d", wishlist.ID, index),
					Type:        "order",
					Title:       item.DishName,
					Description: wishlist.Note,
					CoverImage:  item.CoverImage,
					Tag:         "愿望单",
					Status:      "done",
					Calories:    item.Calories * int64(item.Quantity),
					OccurredAt:  wishlist.UpdatedAt,
				})
			}
		}
	}

	if recordType == "" || recordType == "daily" {
		var daily []model.DailyFoodRecord
		if err := s.db.WithContext(ctx).
			Where("user_id = ?", user.ID).
			Find(&daily).Error; err != nil {
			return nil, err
		}
		for _, record := range daily {
			records = append(records, foodRecordView{
				ID:          fmt.Sprintf("daily-%d", record.ID),
				Type:        "daily",
				Title:       record.Title,
				Description: record.Description,
				Tag:         record.Tag,
				Status:      "recorded",
				OccurredAt:  record.OccurredAt,
			})
		}
	}

	sort.Slice(records, func(i, j int) bool {
		return records[i].OccurredAt.After(records[j].OccurredAt)
	})
	return map[string]any{"records": records}, nil
}

func (s *FunctionService) CreateFoodRecord(ctx context.Context, openID, title, description, tag string) (map[string]any, error) {
	user, err := s.mustGetUserByOpenID(ctx, openID)
	if err != nil {
		return nil, err
	}
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, badRequest("请填写记录标题")
	}
	if len([]rune(title)) > 128 || len([]rune(description)) > 512 {
		return nil, badRequest("记录内容过长")
	}
	if !dailyFoodTags[tag] {
		return nil, badRequest("饮食标签错误")
	}

	now := time.Now()
	record := model.DailyFoodRecord{
		UserID:      user.ID,
		Title:       title,
		Description: strings.TrimSpace(description),
		Tag:         tag,
		OccurredAt:  now,
		CreatedAt:   now,
	}
	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return nil, err
	}
	return map[string]any{"success": true, "recordId": record.ID}, nil
}

func (s *FunctionService) SaveCategory(ctx context.Context, action string, category map[string]any, categoryID uint64) (map[string]any, error) {
	if action == "delete" {
		if categoryID == 0 {
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
	inputID := uintValue(category["_id"])
	if _, updating := category["_id"]; updating && inputID == 0 {
		return nil, badRequest("分类ID无效")
	}
	if value, swapping := category["swapWith"]; swapping {
		otherID := uintValue(value)
		if inputID == 0 || otherID == 0 || inputID == otherID {
			return nil, badRequest("排序分类无效")
		}
		err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var categories []model.Category
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id IN ?", []uint64{inputID, otherID}).Order("id asc").Find(&categories).Error; err != nil {
				return err
			}
			if len(categories) != 2 {
				return notFound("分类不存在，请刷新后重试")
			}
			categories[0].SortOrder, categories[1].SortOrder = categories[1].SortOrder, categories[0].SortOrder
			for index := range categories {
				if err := tx.Save(&categories[index]).Error; err != nil {
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
	if inputID > 0 {
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
	fields := make(map[string]any, len(payload))
	for key, value := range payload {
		if key != "_id" {
			fields[key] = value
		}
	}
	body, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, target)
}

func applyDishPatch(dst *model.Dish, input map[string]any) error {
	var partial model.Dish
	if err := decodePayload(input, &partial); err != nil {
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
	if err := decodePayload(input, &partial); err != nil {
		return err
	}

	if _, ok := input["name"]; ok {
		name := strings.TrimSpace(partial.Name)
		if name == "" || utf8.RuneCountInString(name) > 64 {
			return fmt.Errorf("分类名称须为1至64字")
		}
		dst.Name = name
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

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
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

func uintValue(value any) uint64 {
	switch v := value.(type) {
	case uint64:
		return v
	case uint:
		return uint64(v)
	case int:
		if v > 0 {
			return uint64(v)
		}
	case int64:
		if v > 0 {
			return uint64(v)
		}
	case float64:
		if v > 0 && v == math.Trunc(v) && v < math.Exp2(64) {
			return uint64(v)
		}
	case string:
		parsed, err := strconv.ParseUint(strings.TrimSpace(v), 10, 64)
		if err != nil {
			return 0
		}
		return parsed
	}
	return 0
}

func orderQueryByIdentifier(query *gorm.DB, identifier string) *gorm.DB {
	column, value := orderIdentifierCondition(identifier)
	return query.Where(column+" = ?", value)
}

func orderIdentifierCondition(identifier string) (string, any) {
	identifier = strings.TrimSpace(identifier)
	if id := uintValue(identifier); id > 0 {
		return "id", id
	}
	return "order_number", identifier
}

func (s *FunctionService) mustGetUserByOpenID(ctx context.Context, openID string) (*model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).Where("open_id = ?", openID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, notFound("用户不存在")
		}
		return nil, err
	}
	return &user, nil
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
