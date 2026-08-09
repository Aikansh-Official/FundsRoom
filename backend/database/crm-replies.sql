CREATE TABLE IF NOT EXISTS customer_query_replies (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  query_id CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_query_replies_query_fk FOREIGN KEY (query_id) REFERENCES customer_queries(id) ON DELETE CASCADE,
  CONSTRAINT customer_query_replies_user_fk FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX customer_query_replies_query_created_idx (query_id, created_at)
);
