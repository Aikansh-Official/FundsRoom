import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/', async (_req, res) => {
  const [customerCount, productCount, lowStock, recentChallans, followUps] = await Promise.all([
    query<{ total: string }>('SELECT COUNT(*) AS total FROM customers'),
    query<{ total: string }>('SELECT COUNT(*) AS total FROM products'),
    query(
      `SELECT id, product_name AS "productName", sku, current_stock AS "currentStock", minimum_stock_alert_quantity AS "minimumStockAlertQuantity"
       FROM products WHERE current_stock <= minimum_stock_alert_quantity ORDER BY current_stock ASC LIMIT 5`,
    ),
    query(
      `SELECT c.id, c.challan_number AS "challanNumber", c.status, c.created_at AS "createdAt", cu.customer_name AS "customerName"
       FROM challans c JOIN customers cu ON cu.id = c.customer_id ORDER BY c.created_at DESC LIMIT 5`,
    ),
    query(
      `SELECT id, customer_name AS "customerName", business_name AS "businessName", follow_up_date AS "followUpDate", status
       FROM customers WHERE follow_up_date IS NOT NULL AND follow_up_date >= CURRENT_DATE
       ORDER BY follow_up_date ASC LIMIT 5`,
    ),
  ]);
  return res.json({
    data: {
      metrics: { totalCustomers: Number(customerCount.rows[0].total), totalProducts: Number(productCount.rows[0].total), lowStockCount: lowStock.rows.length },
      lowStockProducts: lowStock.rows,
      recentChallans: recentChallans.rows,
      upcomingFollowUps: followUps.rows,
    },
  });
});
