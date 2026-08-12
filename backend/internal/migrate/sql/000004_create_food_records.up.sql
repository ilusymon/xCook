CREATE TABLE IF NOT EXISTS daily_food_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(128) NOT NULL,
  description VARCHAR(512) NOT NULL DEFAULT '',
  tag VARCHAR(32) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_daily_food_records_user_id (user_id),
  INDEX idx_daily_food_records_occurred_at (occurred_at)
);
