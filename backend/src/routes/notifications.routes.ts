import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate } from '../middleware/auth.js';

type NotificationRow = { id: string; type: string; title: string; detail: string; priority: string; readAt: string | null; createdAt: string };

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

let syncInFlight: Promise<void> | null = null;

/** Reconciles persisted notifications with the current CRM and inventory state. */
function syncNotifications() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    await query(
      `INSERT INTO notifications (id, type, title, detail, priority, related_type, related_id)
       SELECT UUID(), 'LOW_STOCK', 'Low stock:', CONCAT(product_name, ' has ', current_stock, ' units left'), 'HIGH', 'PRODUCT', id
       FROM products WHERE current_stock <= minimum_stock_alert_quantity
       ON DUPLICATE KEY UPDATE title = VALUES(title), detail = VALUES(detail), priority = VALUES(priority)`,
    );
    await query(
      `INSERT INTO notifications (id, type, title, detail, priority, related_type, related_id)
       SELECT UUID(), 'FOLLOW_UP', 'Follow-up due:', CONCAT(customer_name, ' / ', business_name, ' / ', DATE_FORMAT(follow_up_date, '%b %e')), 'MEDIUM', 'CUSTOMER', id
       FROM customers WHERE follow_up_date IS NOT NULL
         AND follow_up_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)
       ON DUPLICATE KEY UPDATE title = VALUES(title), detail = VALUES(detail), priority = VALUES(priority)`,
    );
    await query(
      `INSERT INTO notifications (id, type, title, detail, priority, related_type, related_id)
       SELECT UUID(), 'CUSTOMER_QUERY', CONCAT('Open query: ', q.subject), CONCAT(c.customer_name, ' / ', LEFT(q.message, 100)), q.priority, 'QUERY', q.id
       FROM customer_queries q JOIN customers c ON c.id = q.customer_id
       WHERE q.status <> 'RESOLVED'
       ON DUPLICATE KEY UPDATE title = VALUES(title), detail = VALUES(detail), priority = VALUES(priority)`,
    );
    await query(
      `DELETE n FROM notifications n
       LEFT JOIN products p ON n.related_type = 'PRODUCT' AND n.related_id = p.id AND p.current_stock <= p.minimum_stock_alert_quantity
       LEFT JOIN customers c ON n.related_type = 'CUSTOMER' AND n.related_id = c.id AND c.follow_up_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)
       LEFT JOIN customer_queries q ON n.related_type = 'QUERY' AND n.related_id = q.id AND q.status <> 'RESOLVED'
       WHERE (n.type = 'LOW_STOCK' AND p.id IS NULL)
          OR (n.type = 'FOLLOW_UP' AND c.id IS NULL)
          OR (n.type = 'CUSTOMER_QUERY' AND q.id IS NULL)`,
    );
  })().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

notificationsRouter.get('/', async (req, res) => {
  await syncNotifications();
  const result = await query<NotificationRow>(
    `SELECT n.id, n.type, n.title, n.detail, n.priority, nr.read_at AS "readAt", n.created_at AS "createdAt"
     FROM notifications n
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
     ORDER BY (nr.notification_id IS NULL) DESC, n.created_at DESC LIMIT 30`,
    [req.user!.id],
  );
  const unread = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM notifications n
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE nr.notification_id IS NULL`, [req.user!.id],
  );
  return res.json({ data: result.rows, unreadCount: Number(unread.rows[0].total) });
});

notificationsRouter.patch('/read-all', async (req, res) => {
  await query(
    `INSERT INTO notification_reads (notification_id, user_id)
     SELECT id, $1 FROM notifications
     ON DUPLICATE KEY UPDATE read_at = notification_reads.read_at`, [req.user!.id],
  );
  return res.json({ data: { updated: true } });
});

notificationsRouter.patch('/:notificationId/read', async (req, res) => {
  const notification = await query('SELECT id FROM notifications WHERE id = $1', [req.params.notificationId]);
  if (!notification.rows[0]) return res.status(404).json({ message: 'Notification not found.' });
  await query(
    `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2)
     ON DUPLICATE KEY UPDATE read_at = notification_reads.read_at`, [req.params.notificationId, req.user!.id],
  );
  return res.json({ data: { id: req.params.notificationId, read: true } });
});
