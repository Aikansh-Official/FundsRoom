CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role ENUM('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_name VARCHAR(160) NOT NULL,
  mobile VARCHAR(30) NOT NULL,
  email VARCHAR(255),
  business_name VARCHAR(180) NOT NULL,
  gst_number VARCHAR(30),
  customer_type ENUM('RETAIL', 'WHOLESALE', 'DISTRIBUTOR') NOT NULL,
  address TEXT NOT NULL,
  status ENUM('LEAD', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'LEAD',
  follow_up_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX customers_search_idx (customer_name, business_name, mobile)
);

CREATE TABLE customer_follow_ups (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  note TEXT NOT NULL,
  follow_up_date DATE,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_follow_ups_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT customer_follow_ups_user_fk FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE products (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_name VARCHAR(180) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  current_stock INT NOT NULL DEFAULT 0,
  minimum_stock_alert_quantity INT NOT NULL DEFAULT 0,
  warehouse_location VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT products_positive_price CHECK (unit_price >= 0),
  CONSTRAINT products_non_negative_stock CHECK (current_stock >= 0),
  CONSTRAINT products_non_negative_alert CHECK (minimum_stock_alert_quantity >= 0),
  INDEX products_search_idx (product_name, sku, category)
);

CREATE TABLE stock_movements (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  quantity_changed INT NOT NULL,
  movement_type ENUM('IN', 'OUT') NOT NULL,
  reason TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id CHAR(36),
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_movements_product_fk FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT stock_movements_user_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT stock_movements_positive_quantity CHECK (quantity_changed > 0),
  INDEX stock_movements_product_created_idx (product_id, created_at)
);

CREATE TABLE challan_sequence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY
);

CREATE TABLE challans (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  challan_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  total_quantity INT NOT NULL DEFAULT 0,
  status ENUM('DRAFT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  created_by CHAR(36) NOT NULL,
  confirmed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT challans_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT challans_user_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT challans_non_negative_total CHECK (total_quantity >= 0),
  INDEX challans_customer_created_idx (customer_id, created_at)
);

CREATE TABLE challan_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  challan_id CHAR(36) NOT NULL,
  product_id CHAR(36),
  product_name_snapshot VARCHAR(180) NOT NULL,
  sku_snapshot VARCHAR(80) NOT NULL,
  unit_price_snapshot DECIMAL(12, 2) NOT NULL,
  quantity INT NOT NULL,
  CONSTRAINT challan_items_challan_fk FOREIGN KEY (challan_id) REFERENCES challans(id) ON DELETE CASCADE,
  CONSTRAINT challan_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT challan_items_non_negative_price CHECK (unit_price_snapshot >= 0),
  CONSTRAINT challan_items_positive_quantity CHECK (quantity > 0)
);

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  detail TEXT NOT NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  related_type VARCHAR(40) NOT NULL,
  related_id CHAR(36) NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY notifications_related_unique (type, related_type, related_id),
  INDEX notifications_unread_idx (read_at, created_at)
);

CREATE TABLE notification_reads (
  notification_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT notification_reads_notification_fk FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT notification_reads_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX notification_reads_user_idx (user_id, read_at)
);
