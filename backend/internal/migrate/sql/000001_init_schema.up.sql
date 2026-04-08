CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  open_id VARCHAR(64) NOT NULL UNIQUE,
  nick_name VARCHAR(128) NOT NULL DEFAULT '',
  avatar_url VARCHAR(1024) NOT NULL DEFAULT '',
  role VARCHAR(32) NOT NULL DEFAULT 'both',
  star_coins BIGINT NOT NULL DEFAULT 100,
  coin_log JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_users_open_id (open_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  icon VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_categories_sort_order (sort_order)
);

INSERT INTO categories (name, icon, sort_order, is_active, created_at, updated_at)
VALUES
    ('荤菜', 'meat', 1, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('素菜', 'vegetable', 2, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('汤品', 'soup', 3, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('主食', 'staple', 4, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('甜品', 'dessert', 5, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('饮品', 'drink', 6, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

CREATE TABLE IF NOT EXISTS dishes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  cover_image VARCHAR(1024) NOT NULL DEFAULT '',
  category_id BIGINT UNSIGNED NOT NULL,
  price BIGINT NOT NULL,
  calories BIGINT NOT NULL DEFAULT 0,
  preparation_time INT NOT NULL DEFAULT 0,
  difficulty INT NOT NULL DEFAULT 1,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  option_groups JSON NOT NULL,
  materials JSON NOT NULL,
  steps JSON NOT NULL,
  video_url VARCHAR(1024) NOT NULL DEFAULT '',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_dishes_category_id (category_id),
  INDEX idx_dishes_created_by (created_by),
  INDEX idx_dishes_available_deleted (is_available, is_deleted)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  items JSON NOT NULL,
  total_price BIGINT NOT NULL,
  total_calories BIGINT NOT NULL DEFAULT 0,
  note TEXT NULL,
  status_history JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_orders_user_id (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created_at (created_at)
);
