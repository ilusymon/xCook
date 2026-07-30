package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestCoinLogEntryUnmarshalJSON(t *testing.T) {
	var entry CoinLogEntry
	data := []byte(`{"type":"credit","amount":100,"reason":"test","timestamp":"2026-03-25 07:53:04"}`)
	if err := json.Unmarshal(data, &entry); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	expected := time.Date(2026, 3, 25, 7, 53, 4, 0, time.Local)
	if !entry.Timestamp.Equal(expected) {
		t.Fatalf("Timestamp = %v, want %v", entry.Timestamp, expected)
	}
}

func TestCoinLogEntryUnmarshalJSONRejectsRFC3339(t *testing.T) {
	var entry CoinLogEntry
	data := []byte(`{"type":"credit","amount":100,"reason":"test","timestamp":"2026-03-25T07:53:04+08:00"}`)
	if err := json.Unmarshal(data, &entry); err == nil {
		t.Fatal("Unmarshal() error = nil, want invalid timestamp error")
	}
}

func TestCoinLogEntryMarshalJSONUsesMySQLDatetime(t *testing.T) {
	entry := CoinLogEntry{
		Type:      "credit",
		Amount:    100,
		Reason:    "test",
		Timestamp: time.Date(2026, 3, 25, 7, 53, 4, 0, time.FixedZone("UTC+8", 8*60*60)),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("Unmarshal marshaled entry: %v", err)
	}
	if payload["timestamp"] != "2026-03-25 07:53:04" {
		t.Fatalf("timestamp = %q", payload["timestamp"])
	}
}
