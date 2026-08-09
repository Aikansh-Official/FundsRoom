import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database/pool.js';
import { authenticate } from '../middleware/auth.js';

const rangeSchema = z.coerce.number().int().min(7).max(365).default(30);

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

analyticsRouter.get('/sales', async (req, res) => {
  const days = rangeSchema.parse(req.query.days ?? 30);
  const [daily, byUser, details] = await Promise.all([
    query(
      `SELECT DATE(c.confirmed_at) AS saleDate, COUNT(DISTINCT c.id) AS challans,
              COALESCE(SUM(ci.quantity * ci.unit_price_snapshot), 0) AS revenue,
              COALESCE(SUM(ci.quantity), 0) AS units
       FROM challans c JOIN challan_items ci ON ci.challan_id = c.id
       WHERE c.status = 'CONFIRMED' AND c.confirmed_at >= DATE_SUB(CURRENT_DATE, INTERVAL ${days} DAY)
       GROUP BY DATE(c.confirmed_at) ORDER BY saleDate ASC`,
    ),
    query(
      `SELECT u.id AS userId, u.name AS userName, COUNT(DISTINCT c.id) AS challans,
              COALESCE(SUM(ci.quantity * ci.unit_price_snapshot), 0) AS revenue,
              COALESCE(SUM(ci.quantity), 0) AS units
       FROM challans c JOIN users u ON u.id = c.created_by
       JOIN challan_items ci ON ci.challan_id = c.id
       WHERE c.status = 'CONFIRMED' AND c.confirmed_at >= DATE_SUB(CURRENT_DATE, INTERVAL ${days} DAY)
       GROUP BY u.id, u.name ORDER BY revenue DESC, userName ASC`,
    ),
    query(
      `SELECT DATE(c.confirmed_at) AS saleDate, c.challan_number AS challanNumber,
              u.name AS sellerName, cu.customer_name AS customerName, cu.business_name AS businessName,
              ci.product_name_snapshot AS productName, ci.sku_snapshot AS sku,
              ci.quantity, ci.unit_price_snapshot AS unitPrice,
              (ci.quantity * ci.unit_price_snapshot) AS revenue
       FROM challans c
       JOIN users u ON u.id = c.created_by
       JOIN customers cu ON cu.id = c.customer_id
       JOIN challan_items ci ON ci.challan_id = c.id
       WHERE c.status = 'CONFIRMED' AND c.confirmed_at >= DATE_SUB(CURRENT_DATE, INTERVAL ${days} DAY)
       ORDER BY saleDate ASC, c.confirmed_at ASC, c.challan_number ASC, ci.product_name_snapshot ASC`,
    ),
  ]);
  return res.json({ data: { days, daily: daily.rows, byUser: byUser.rows, details: details.rows } });
});
