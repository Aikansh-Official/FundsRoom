CREATE TABLE IF NOT EXISTS notifications (
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
