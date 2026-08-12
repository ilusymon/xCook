package service

import (
	"reflect"
	"testing"

	"xcook/backend/internal/model"
)

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
