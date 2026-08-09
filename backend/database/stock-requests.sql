CREATE TABLE IF NOT EXISTS stock_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id CHAR(36) NOT NULL,
  requested_by CHAR(36) NOT NULL,
  quantity INT NOT NULL,
  urgency ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  message VARCHAR(1000) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by CHAR(36),
  reviewed_at TIMESTAMP NULL,
  review_note VARCHAR(1000),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_requests_product_fk FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT stock_requests_requester_fk FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT stock_requests_reviewer_fk FOREIGN KEY (reviewed_by) REFERENCES users(id),
  CONSTRAINT stock_requests_positive_quantity CHECK (quantity > 0),
  INDEX stock_requests_status_created_idx (status, created_at),
  INDEX stock_requests_product_idx (product_id)
);
