package service

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"xcook/backend/internal/model"
)

type queryRecorder struct {
	logger.Interface
	queries []string
}

func (r *queryRecorder) Trace(_ context.Context, _ time.Time, query func() (string, int64), _ error) {
	sql, _ := query()
	r.queries = append(r.queries, sql)
}

func TestChefMenuIncludesInactiveCategoriesAndAllDishes(t *testing.T) {
	recorder := &queryRecorder{Interface: logger.Default}
	db, err := gorm.Open(mysql.New(mysql.Config{DSN: "user:pass@tcp(127.0.0.1:3306)/unused", SkipInitializeWithVersion: true}), &gorm.Config{
		DryRun: true, DisableAutomaticPing: true, Logger: recorder,
	})
	if err != nil {
		t.Fatal(err)
	}
	s := NewFunctionService(db)
	if _, err := s.GetMenu(context.Background(), "chef"); err != nil {
		t.Fatal(err)
	}
	chefQueries := strings.Join(recorder.queries, " ")
	if strings.Contains(chefQueries, "is_active") || strings.Contains(chefQueries, "is_available") || strings.Contains(chefQueries, "LIMIT 100") {
		t.Fatalf("chef menu hides manageable dishes: %s", chefQueries)
	}
	recorder.queries = nil
	if _, err := s.GetMenu(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
	ordererQueries := strings.Join(recorder.queries, " ")
	if !strings.Contains(ordererQueries, "is_active") || !strings.Contains(ordererQueries, "is_available") {
		t.Fatalf("orderer menu exposes unavailable dishes: %s", ordererQueries)
	}
}

func TestResourcePatchesIgnoreRouteIDAndPreserveRecipe(t *testing.T) {
	dish := model.Dish{ID: 42, Name: "番茄炒蛋", CoverImage: "cover.jpg", Steps: []model.Step{{Description: "炒熟"}}}
	if err := applyDishPatch(&dish, map[string]any{"_id": "42", "isAvailable": false}); err != nil {
		t.Fatal(err)
	}
	if dish.ID != 42 || dish.IsAvailable || dish.CoverImage != "cover.jpg" || len(dish.Steps) != 1 {
		t.Fatalf("patch lost recipe: %#v", dish)
	}
	category := model.Category{ID: 3, Name: "主食", IsActive: true}
	if err := applyCategoryPatch(&category, map[string]any{"_id": "3", "isActive": false}); err != nil {
		t.Fatal(err)
	}
	if category.ID != 3 || category.Name != "主食" || category.IsActive {
		t.Fatalf("patch lost category: %#v", category)
	}
}

func TestSelectedOptionsValidation(t *testing.T) {
	groups := []model.OptionGroup{
		{GroupName: "辣度", Type: "single", Required: true, Options: []model.Option{{Value: "微辣"}, {Value: "不辣"}}},
		{GroupName: "加料", Type: "multi", Options: []model.Option{{Value: "蛋"}, {Value: "葱"}}},
	}
	if err := validateSelectedOptions(groups, map[string][]string{"辣度": {"微辣"}, "加料": {"蛋", "葱"}}); err != nil {
		t.Fatal(err)
	}
	for _, selections := range []map[string][]string{
		nil,
		{"辣度": {"微辣", "不辣"}},
		{"辣度": {"中辣"}},
		{"辣度": {"微辣"}, "旧口味": {"旧选项"}},
		{"辣度": {"微辣"}, "加料": {"蛋", "蛋"}},
	} {
		if err := validateSelectedOptions(groups, selections); err == nil {
			t.Fatalf("accepted invalid selections: %#v", selections)
		}
	}
}

func TestValidateDish(t *testing.T) {
	valid := model.Dish{Name: "番茄炒蛋", CategoryID: 1, Difficulty: 1}
	if err := validateDish(&valid); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*model.Dish){
		func(d *model.Dish) { d.Name = " " },
		func(d *model.Dish) { d.CategoryID = 0 },
		func(d *model.Dish) { d.Calories = -1 },
		func(d *model.Dish) { d.Difficulty = 4 },
		func(d *model.Dish) { d.Materials = []model.Material{{Name: " "}} },
		func(d *model.Dish) { d.Steps = []model.Step{{Description: ""}} },
		func(d *model.Dish) { d.OptionGroups = []model.OptionGroup{{GroupName: "辣度", Type: "single"}} },
	} {
		dish := valid
		mutate(&dish)
		if err := validateDish(&dish); err == nil {
			t.Fatalf("accepted invalid dish: %#v", dish)
		}
	}
}

func TestWishlistAndProfileRejectInvalidInputBeforeDatabaseWrite(t *testing.T) {
	s := NewFunctionService(nil)
	for _, quantity := range []int{-1, 0, 100} {
		if _, err := s.PlaceOrder(context.Background(), "user", []model.OrderItem{{DishID: 1, Quantity: quantity}}, ""); err == nil {
			t.Fatalf("accepted quantity %d", quantity)
		}
	}
	if _, err := s.PlaceOrder(context.Background(), "user", []model.OrderItem{{DishID: 1, Quantity: 1}}, strings.Repeat("字", 201)); err == nil {
		t.Fatal("accepted oversized note")
	}
	for _, name := range []string{" ", strings.Repeat("字", 33)} {
		if _, err := s.UpdateUserInfo(context.Background(), "user", name); err == nil {
			t.Fatal("accepted invalid nickname")
		}
	}
	for _, payload := range []map[string]any{
		{"_id": "bad"},
		{"_id": 1, "swapWith": 1},
		{"_id": 1, "swapWith": "bad"},
	} {
		if _, err := s.SaveCategory(context.Background(), "", payload, 0); err == nil {
			t.Fatal("accepted invalid category update")
		}
	}
}

func TestParseOrderItemsAcceptsStringDishID(t *testing.T) {
	items, err := parseOrderItems([]map[string]any{
		{"dishId": "42", "quantity": 2, "selectedOptions": map[string][]string{"辣度": {"微辣"}}},
	})
	if err != nil {
		t.Fatalf("parseOrderItems() error = %v", err)
	}
	if len(items) != 1 || items[0].DishID != 42 || items[0].Quantity != 2 {
		t.Fatalf("items = %#v", items)
	}
	wantOptions := map[string][]string{"辣度": {"微辣"}}
	if !reflect.DeepEqual(items[0].SelectedOptions, wantOptions) {
		t.Fatalf("selectedOptions = %#v, want %#v", items[0].SelectedOptions, wantOptions)
	}
}

func TestParseOrderItemsRejectsInvalidIdentityAndQuantity(t *testing.T) {
	for _, items := range []any{
		[]map[string]any{{"dishId": "", "quantity": 1}},
		[]map[string]any{{"dishId": "42", "quantity": 0}},
		[]map[string]any{{"dishId": "42suffix", "quantity": 1}},
		[]map[string]any{{"dishId": 42.5, "quantity": 1}},
	} {
		if _, err := parseOrderItems(items); err == nil {
			t.Fatalf("parseOrderItems(%#v) error = nil", items)
		}
	}
}

func TestAdvanceWishlistOrderItemAndDeriveStatus(t *testing.T) {
	items := []model.OrderItem{
		{Status: "accepted"},
		{Status: "accepted"},
	}

	if err := advanceWishlistOrderItem(&items[0], 2, "start"); err != nil {
		t.Fatalf("start item: %v", err)
	}
	if got := deriveWishlistStatus(items); got != "cooking" {
		t.Fatalf("deriveWishlistStatus() = %q, want cooking", got)
	}
	if err := advanceWishlistOrderItem(&items[0], 2, "next"); err != nil {
		t.Fatalf("advance item: %v", err)
	}
	if items[0].CurrentStep != 1 || items[0].Status != "cooking" {
		t.Fatalf("first progress = %#v", items[0])
	}
	if err := advanceWishlistOrderItem(&items[0], 2, "next"); err != nil {
		t.Fatalf("finish first item: %v", err)
	}
	if err := advanceWishlistOrderItem(&items[1], 0, "start"); err != nil {
		t.Fatalf("start second item: %v", err)
	}
	if err := advanceWishlistOrderItem(&items[1], 0, "next"); err != nil {
		t.Fatalf("finish second item: %v", err)
	}
	if got := deriveWishlistStatus(items); got != "done" {
		t.Fatalf("deriveWishlistStatus() = %q, want done", got)
	}
}

func TestDailyFoodTags(t *testing.T) {
	for _, tag := range []string{"早餐", "午餐", "晚餐", "加餐"} {
		if !dailyFoodTags[tag] {
			t.Fatalf("dailyFoodTags[%q] = false", tag)
		}
	}
	if dailyFoodTags["夜宵"] {
		t.Fatal("unexpected unapproved tag")
	}
}

func TestOrderQueryByIdentifierAcceptsIDAndOrderNumber(t *testing.T) {
	tests := []struct {
		identifier string
		column     string
		value      any
	}{
		{identifier: "42", column: "id", value: uint64(42)},
		{identifier: "XC202608120001", column: "order_number", value: "XC202608120001"},
	}
	for _, test := range tests {
		column, value := orderIdentifierCondition(test.identifier)
		if column != test.column || !reflect.DeepEqual(value, test.value) {
			t.Fatalf("identifier %q = (%q, %#v), want (%q, %#v)", test.identifier, column, value, test.column, test.value)
		}
	}
}
