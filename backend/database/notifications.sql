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

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT notification_reads_notification_fk FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT notification_reads_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX notification_reads_user_idx (user_id, read_at)
);
