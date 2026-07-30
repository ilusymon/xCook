package model

import (
	"encoding/json"
	"fmt"
	"time"
)

type CoinLogEntry struct {
	Type      string    `json:"type"`
	Amount    int64     `json:"amount"`
	Reason    string    `json:"reason"`
	OrderID   uint64    `json:"orderId,omitempty"`
	By        uint64    `json:"by,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

const coinLogTimeLayout = "2006-01-02 15:04:05"

func (entry CoinLogEntry) MarshalJSON() ([]byte, error) {
	type coinLogEntry CoinLogEntry

	return json.Marshal(struct {
		coinLogEntry
		Timestamp string `json:"timestamp"`
	}{
		coinLogEntry: coinLogEntry(entry),
		Timestamp:    entry.Timestamp.In(time.Local).Format(coinLogTimeLayout),
	})
}

func (entry *CoinLogEntry) UnmarshalJSON(data []byte) error {
	type coinLogEntry CoinLogEntry

	var decoded coinLogEntry
	payload := struct {
		*coinLogEntry
		Timestamp string `json:"timestamp"`
	}{
		coinLogEntry: &decoded,
	}

	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}

	if payload.Timestamp != "" {
		parsed, err := time.ParseInLocation(coinLogTimeLayout, payload.Timestamp, time.Local)
		if err != nil {
			return fmt.Errorf("parse coin log timestamp %q: %w", payload.Timestamp, err)
		}
		decoded.Timestamp = parsed
	}

	*entry = CoinLogEntry(decoded)
	return nil
}

type Category struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"_id"`
	Name      string    `gorm:"size:64;not null" json:"name"`
	Icon      string    `gorm:"size:64;not null" json:"icon"`
	SortOrder int       `gorm:"not null" json:"sortOrder"`
	IsActive  bool      `gorm:"not null;default:true" json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Option struct {
	Label      string `json:"label"`
	Value      string `json:"value"`
	ExtraPrice int64  `json:"extraPrice"`
}

type OptionGroup struct {
	GroupName string   `json:"groupName"`
	Type      string   `json:"type"`
	Required  bool     `json:"required"`
	Options   []Option `json:"options"`
}

type Material struct {
	Name   string `json:"name"`
	Amount string `json:"amount"`
	Note   string `json:"note"`
}

type Step struct {
	StepNumber  int    `json:"stepNumber"`
	Description string `json:"description"`
	Image       string `json:"image"`
	Duration    int    `json:"duration"`
}

type Dish struct {
	ID              uint64        `gorm:"primaryKey;autoIncrement" json:"_id"`
	Name            string        `gorm:"size:128;not null" json:"name"`
	Description     string        `gorm:"type:text" json:"description"`
	CoverImage      string        `gorm:"size:1024" json:"coverImage"`
	CategoryID      uint64        `gorm:"index;not null" json:"categoryId"`
	Price           int64         `gorm:"not null" json:"price"`
	Calories        int64         `gorm:"not null;default:0" json:"calories"`
	PreparationTime int           `gorm:"not null;default:0" json:"preparationTime"`
	Difficulty      int           `gorm:"not null;default:1" json:"difficulty"`
	IsAvailable     bool          `gorm:"not null;default:true" json:"isAvailable"`
	IsDeleted       bool          `gorm:"not null;default:false" json:"isDeleted"`
	OptionGroups    []OptionGroup `gorm:"type:json;serializer:json" json:"optionGroups"`
	Materials       []Material    `gorm:"type:json;serializer:json" json:"materials"`
	Steps           []Step        `gorm:"type:json;serializer:json" json:"steps"`
	VideoURL        string        `gorm:"size:1024" json:"videoUrl"`
	CreatedBy       uint64        `gorm:"index;not null" json:"createdBy"`
	CreatedAt       time.Time     `json:"createdAt"`
	UpdatedAt       time.Time     `json:"updatedAt"`
}

type OrderItem struct {
	DishID          uint64              `json:"dishId"`
	DishName        string              `json:"dishName"`
	CoverImage      string              `json:"coverImage"`
	UnitPrice       int64               `json:"unitPrice"`
	Quantity        int                 `json:"quantity"`
	SelectedOptions map[string][]string `gorm:"type:json;serializer:json" json:"selectedOptions"`
	ExtraPrice      int64               `json:"extraPrice"`
	ItemTotal       int64               `json:"itemTotal"`
	Calories        int64               `json:"calories"`
}

type StatusHistoryEntry struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	By        uint64    `json:"by"`
}

type Order struct {
	ID            uint64               `gorm:"primaryKey;autoIncrement" json:"_id"`
	OrderNumber   string               `gorm:"size:32;uniqueIndex;not null" json:"orderNumber"`
	UserID        uint64               `gorm:"index;not null" json:"userId"`
	Status        string               `gorm:"size:32;index;not null" json:"status"`
	Items         []OrderItem          `gorm:"type:json;serializer:json" json:"items"`
	TotalPrice    int64                `gorm:"not null" json:"totalPrice"`
	TotalCalories int64                `gorm:"not null;default:0" json:"totalCalories"`
	Note          string               `gorm:"type:text" json:"note"`
	StatusHistory []StatusHistoryEntry `gorm:"type:json;serializer:json" json:"statusHistory"`
	CreatedAt     time.Time            `json:"createdAt"`
	UpdatedAt     time.Time            `json:"updatedAt"`
}

type User struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement" json:"_id"`
	OpenID    string         `gorm:"size:64;uniqueIndex;not null" json:"openid"`
	NickName  string         `gorm:"size:128" json:"nickName"`
	AvatarURL string         `gorm:"size:1024" json:"avatarUrl"`
	Role      string         `gorm:"size:32;not null;default:both" json:"role"`
	StarCoins int64          `gorm:"not null;default:100" json:"starCoins"`
	CoinLog   []CoinLogEntry `gorm:"type:json;serializer:json" json:"coinLog"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

func (User) TableName() string {
	return "users"
}

func (Category) TableName() string {
	return "categories"
}

func (Dish) TableName() string {
	return "dishes"
}

func (Order) TableName() string {
	return "orders"
}
