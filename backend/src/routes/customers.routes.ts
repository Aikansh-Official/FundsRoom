import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query } from '../database/pool.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';
import { parsePagination } from '../utils/pagination.js';

const customerSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  mobile: z.string().trim().min(6).max(30),
  email: z.string().email().nullable().optional(),
  businessName: z.string().trim().min(2).max(180),
  gstNumber: z.string().trim().max(30).nullable().optional(),
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']),
  address: z.string().trim().min(5),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).default('LEAD'),
  followUpDate: z.string().date().nullable().optional(),
});

const followUpSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  followUpDate: z.string().date().nullable().optional(),
});
const querySchema = z.object({ subject: z.string().trim().min(3).max(180), message: z.string().trim().min(3).max(3000), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM') });
const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), review: z.string().trim().min(3).max(2000) });

export const customersRouter = Router();
customersRouter.use(authenticate);

customersRouter.get('/', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const result = await query(
    `SELECT id, customer_name AS "customerName", mobile, email, business_name AS "businessName",
            gst_number AS "gstNumber", customer_type AS "customerType", address, status,
            follow_up_date AS "followUpDate", created_at AS "createdAt"
     FROM customers
     WHERE ($1 = '' OR customer_name LIKE CONCAT('%', $1, '%') OR business_name LIKE CONCAT('%', $1, '%') OR mobile LIKE CONCAT('%', $1, '%'))
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [search, limit, offset],
  );
  const count = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM customers
     WHERE ($1 = '' OR customer_name LIKE CONCAT('%', $1, '%') OR business_name LIKE CONCAT('%', $1, '%') OR mobile LIKE CONCAT('%', $1, '%'))`,
    [search],
  );
  return res.json({ data: result.rows, meta: { page, limit, total: Number(count.rows[0].total) } });
});

customersRouter.post('/', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const input = customerSchema.parse(req.body);
  const id = randomUUID();
  await query(
    `INSERT INTO customers (id, customer_name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, input.customerName, input.mobile, input.email ?? null, input.businessName, input.gstNumber ?? null, input.customerType, input.address, input.status, input.followUpDate ?? null],
  );
  const result = await query('SELECT id, customer_name AS "customerName", status, created_at AS "createdAt" FROM customers WHERE id = $1', [id]);
  return res.status(201).json({ data: result.rows[0] });
});

customersRouter.get('/:customerId', async (req, res) => {
  const customer = await query(
    `SELECT id, customer_name AS "customerName", mobile, email, business_name AS "businessName", gst_number AS "gstNumber",
            customer_type AS "customerType", address, status, follow_up_date AS "followUpDate", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM customers WHERE id = $1`,
    [req.params.customerId],
  );
  if (!customer.rows[0]) throw new HttpError(404, 'Customer not found.');
  const followUps = await query(
    `SELECT f.id, f.note, f.follow_up_date AS "followUpDate", f.created_at AS "createdAt", u.name AS "createdBy"
     FROM customer_follow_ups f JOIN users u ON u.id = f.created_by
     WHERE f.customer_id = $1 ORDER BY f.created_at DESC`,
    [req.params.customerId],
  );
  return res.json({ data: { ...customer.rows[0], followUps: followUps.rows } });
});

customersRouter.put('/:customerId', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const input = customerSchema.parse(req.body);
  const result = await query(
    `UPDATE customers SET customer_name=$1, mobile=$2, email=$3, business_name=$4, gst_number=$5,
       customer_type=$6, address=$7, status=$8, follow_up_date=$9 WHERE id=$10`,
    [input.customerName, input.mobile, input.email ?? null, input.businessName, input.gstNumber ?? null, input.customerType, input.address, input.status, input.followUpDate ?? null, req.params.customerId],
  );
  if ((result.rows[0] as unknown as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, 'Customer not found.');
  const updated = await query('SELECT id, customer_name AS "customerName", status, updated_at AS "updatedAt" FROM customers WHERE id = $1', [req.params.customerId]);
  return res.json({ data: updated.rows[0] });
});

customersRouter.post('/:customerId/follow-ups', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const input = followUpSchema.parse(req.body);
  const customer = await query('SELECT id FROM customers WHERE id = $1', [req.params.customerId]);
  if (!customer.rows[0]) throw new HttpError(404, 'Customer not found.');
  const id = randomUUID();
  await query(
    `INSERT INTO customer_follow_ups (id, customer_id, note, follow_up_date, created_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, req.params.customerId, input.note, input.followUpDate ?? null, req.user!.id],
  );
  const result = await query('SELECT id, note, follow_up_date AS "followUpDate", created_at AS "createdAt" FROM customer_follow_ups WHERE id = $1', [id]);
  return res.status(201).json({ data: result.rows[0] });
});

customersRouter.get('/:customerId/queries', async (req, res) => {
  const result = await query(`SELECT id, subject, message, status, priority, created_at AS "createdAt", resolved_at AS "resolvedAt" FROM customer_queries WHERE customer_id = $1 ORDER BY created_at DESC`, [req.params.customerId]);
  return res.json({ data: result.rows });
});

customersRouter.post('/:customerId/queries', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const input = querySchema.parse(req.body); const id = randomUUID();
  await query(`INSERT INTO customer_queries (id, customer_id, subject, message, priority, created_by) VALUES ($1,$2,$3,$4,$5,$6)`, [id, req.params.customerId, input.subject, input.message, input.priority, req.user!.id]);
  return res.status(201).json({ data: (await query(`SELECT id, subject, message, status, priority, created_at AS "createdAt" FROM customer_queries WHERE id = $1`, [id])).rows[0] });
});

customersRouter.patch('/:customerId/queries/:queryId/resolve', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const result = await query(`UPDATE customer_queries SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1 AND customer_id = $2 AND status <> 'RESOLVED'`, [req.params.queryId, req.params.customerId]);
  if ((result.rows[0] as unknown as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, 'Open customer query not found.');
  return res.json({ data: (await query(`SELECT id, status, resolved_at AS "resolvedAt" FROM customer_queries WHERE id = $1`, [req.params.queryId])).rows[0] });
});

customersRouter.get('/:customerId/reviews', async (req, res) => {
  const result = await query(`SELECT r.id, r.rating, r.review, r.created_at AS "createdAt", u.name AS "createdBy" FROM customer_reviews r JOIN users u ON u.id = r.created_by WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [req.params.customerId]);
  return res.json({ data: result.rows });
});

customersRouter.post('/:customerId/reviews', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const input = reviewSchema.parse(req.body); const id = randomUUID();
  await query(`INSERT INTO customer_reviews (id, customer_id, rating, review, created_by) VALUES ($1,$2,$3,$4,$5)`, [id, req.params.customerId, input.rating, input.review, req.user!.id]);
  return res.status(201).json({ data: (await query(`SELECT id, rating, review, created_at AS "createdAt" FROM customer_reviews WHERE id = $1`, [id])).rows[0] });
});
