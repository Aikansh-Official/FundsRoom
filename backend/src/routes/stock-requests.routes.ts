import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query, withTransaction } from '../database/pool.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';

const createSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(100000),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  message: z.string().trim().min(3).max(1000),
});
const reviewSchema = z.object({ note: z.string().trim().max(1000).optional().default('') });

export const stockRequestsRouter = Router();
stockRequestsRouter.use(authenticate);

stockRequestsRouter.get('/', requireRoles('ADMIN', 'SALES', 'WAREHOUSE'), async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
  const result = await query(
    `SELECT r.id, r.product_id AS "productId", p.product_name AS "productName", p.sku,
            p.current_stock AS "currentStock", r.quantity, r.urgency, r.message, r.status,
            r.created_at AS "createdAt", r.reviewed_at AS "reviewedAt", r.review_note AS "reviewNote",
            u.name AS "requestedBy", reviewer.name AS "reviewedBy"
     FROM stock_requests r
     JOIN products p ON p.id = r.product_id
     JOIN users u ON u.id = r.requested_by
     LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
     WHERE ($1 = '' OR r.status = $1) AND ($2 = 'WAREHOUSE' OR r.requested_by = $3 OR $2 = 'ADMIN')
     ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC`,
    [status, req.user!.role, req.user!.id],
  );
  return res.json({ data: result.rows });
});

stockRequestsRouter.post('/', requireRoles('SALES'), async (req, res) => {
  const input = createSchema.parse(req.body);
  const product = await query('SELECT id, product_name AS "productName", current_stock AS "currentStock" FROM products WHERE id = $1', [input.productId]);
  if (!product.rows[0]) throw new HttpError(404, 'Product not found.');
  const id = randomUUID();
  await query(
    `INSERT INTO stock_requests (id, product_id, requested_by, quantity, urgency, message)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, input.productId, req.user!.id, input.quantity, input.urgency, input.message],
  );
  const created = await query(
    `SELECT r.id, r.product_id AS "productId", p.product_name AS "productName", p.sku,
            p.current_stock AS "currentStock", r.quantity, r.urgency, r.message, r.status,
            r.created_at AS "createdAt", u.name AS "requestedBy"
     FROM stock_requests r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.requested_by WHERE r.id = $1`, [id],
  );
  return res.status(201).json({ data: created.rows[0] });
});

stockRequestsRouter.patch('/:requestId/approve', requireRoles('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const input = reviewSchema.parse(req.body ?? {});
  const data = await withTransaction(async (client) => {
    const locked = await client.query<{ id: string; product_id: string; quantity: number; status: string }>(
      'SELECT id, product_id, quantity, status FROM stock_requests WHERE id = $1 FOR UPDATE', [req.params.requestId],
    );
    const request = locked.rows[0];
    if (!request) throw new HttpError(404, 'Stock request not found.');
    if (request.status !== 'PENDING') throw new HttpError(409, 'This stock request has already been reviewed.');
    await client.query(
      'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2', [request.quantity, request.product_id],
    );
    await client.query(
      `INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, reference_type, reference_id, created_by)
       VALUES ($1,$2,$3,'IN',$4,'STOCK_REQUEST',$5,$6)`,
      [randomUUID(), request.product_id, request.quantity, `Approved stock request ${request.id}`, request.id, req.user!.id],
    );
    await client.query(
      'UPDATE stock_requests SET status = \'APPROVED\', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, review_note = $2 WHERE id = $3',
      [req.user!.id, input.note, request.id],
    );
    return (await client.query(
      `SELECT r.id, r.status, r.quantity, r.review_note AS "reviewNote", r.reviewed_at AS "reviewedAt", p.product_name AS "productName", p.current_stock AS "currentStock"
       FROM stock_requests r JOIN products p ON p.id = r.product_id WHERE r.id = $1`, [request.id],
    )).rows[0];
  });
  return res.json({ data });
});

stockRequestsRouter.patch('/:requestId/reject', requireRoles('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const input = reviewSchema.parse(req.body ?? {});
  const result = await query(
    `UPDATE stock_requests SET status = 'REJECTED', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, review_note = $2
     WHERE id = $3 AND status = 'PENDING'`, [req.user!.id, input.note, req.params.requestId],
  );
  if ((result.rows[0] as unknown as { affectedRows?: number })?.affectedRows === 0 && (result as any).affectedRows === 0) {
    const exists = await query('SELECT id FROM stock_requests WHERE id = $1', [req.params.requestId]);
    if (!exists.rows[0]) throw new HttpError(404, 'Stock request not found.');
    throw new HttpError(409, 'This stock request has already been reviewed.');
  }
  return res.json({ data: { id: req.params.requestId, status: 'REJECTED', reviewNote: input.note } });
});
