import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query, withTransaction } from '../database/pool.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';
import { parsePagination } from '../utils/pagination.js';

const productSchema = z.object({
  productName: z.string().trim().min(2).max(180),
  sku: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(100),
  unitPrice: z.coerce.number().nonnegative().max(9999999999),
  currentStock: z.coerce.number().int().nonnegative().default(0),
  minimumStockAlertQuantity: z.coerce.number().int().nonnegative().default(0),
  warehouseLocation: z.string().trim().min(2).max(120),
});

const stockAdjustmentSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  movementType: z.enum(['IN', 'OUT']),
  reason: z.string().trim().min(3).max(500),
});

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get('/', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const lowStockOnly = req.query.lowStock === 'true';
  const result = await query(
    `SELECT id, product_name AS "productName", sku, category, unit_price AS "unitPrice", current_stock AS "currentStock",
            minimum_stock_alert_quantity AS "minimumStockAlertQuantity", warehouse_location AS "warehouseLocation",
            (current_stock <= minimum_stock_alert_quantity) AS "isLowStock", created_at AS "createdAt"
     FROM products
     WHERE ($1 = '' OR product_name LIKE CONCAT('%', $1, '%') OR sku LIKE CONCAT('%', $1, '%') OR category LIKE CONCAT('%', $1, '%'))
       AND ($2 = FALSE OR current_stock <= minimum_stock_alert_quantity)
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [search, lowStockOnly, limit, offset],
  );
  const count = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM products
     WHERE ($1 = '' OR product_name LIKE CONCAT('%', $1, '%') OR sku LIKE CONCAT('%', $1, '%') OR category LIKE CONCAT('%', $1, '%'))
       AND ($2 = FALSE OR current_stock <= minimum_stock_alert_quantity)`,
    [search, lowStockOnly],
  );
  return res.json({ data: result.rows, meta: { page, limit, total: Number(count.rows[0].total) } });
});

productsRouter.post('/', requireRoles('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const input = productSchema.parse(req.body);
  const product = await withTransaction(async (client) => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO products (id, product_name, sku, category, unit_price, current_stock, minimum_stock_alert_quantity, warehouse_location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, input.productName, input.sku, input.category, input.unitPrice, input.currentStock, input.minimumStockAlertQuantity, input.warehouseLocation],
    );
    if (input.currentStock > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, reference_type, created_by)
         VALUES ($1,$2,'IN','Opening stock recorded when the product was created','OPENING_STOCK',$3)`,
        [id, input.currentStock, req.user!.id],
      );
    }
    return (await client.query('SELECT id, product_name AS "productName", sku, current_stock AS "currentStock", created_at AS "createdAt" FROM products WHERE id = $1', [id])).rows[0];
  });
  return res.status(201).json({ data: product });
});

productsRouter.put('/:productId', requireRoles('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const input = productSchema.parse(req.body);
  const result = await query(
    `UPDATE products SET product_name=$1, sku=$2, category=$3, unit_price=$4,
       minimum_stock_alert_quantity=$5, warehouse_location=$6 WHERE id=$7
    `, 
    [input.productName, input.sku, input.category, input.unitPrice, input.minimumStockAlertQuantity, input.warehouseLocation, req.params.productId],
  );
  if ((result.rows[0] as unknown as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, 'Product not found.');
  const updated = await query('SELECT id, product_name AS "productName", sku, current_stock AS "currentStock", updated_at AS "updatedAt" FROM products WHERE id = $1', [req.params.productId]);
  return res.json({ data: updated.rows[0] });
});

productsRouter.post('/:productId/stock-movements', requireRoles('ADMIN', 'WAREHOUSE'), async (req, res) => {
  const input = stockAdjustmentSchema.parse(req.body);
  const data = await withTransaction(async (client) => {
    const locked = await client.query<{ id: string; current_stock: number }>(
      'SELECT id, current_stock FROM products WHERE id = $1 FOR UPDATE', [req.params.productId],
    );
    const product = locked.rows[0];
    if (!product) throw new HttpError(404, 'Product not found.');
    if (input.movementType === 'OUT' && product.current_stock < input.quantity) {
      throw new HttpError(409, 'Insufficient stock. This movement would make stock negative.');
    }
    const multiplier = input.movementType === 'IN' ? 1 : -1;
    await client.query(
      `UPDATE products SET current_stock = current_stock + ($1 * $2) WHERE id = $3`, [multiplier, input.quantity, product.id],
    );
    const movementId = randomUUID();
    await client.query(
      `INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, reference_type, created_by)
       VALUES ($1,$2,$3,$4,$5,'MANUAL_ADJUSTMENT',$6)`,
      [movementId, product.id, input.quantity, input.movementType, input.reason, req.user!.id],
    );
    const updated = await client.query('SELECT id, current_stock AS "currentStock" FROM products WHERE id = $1', [product.id]);
    const movement = { id: movementId, quantityChanged: input.quantity, movementType: input.movementType, reason: input.reason };
    return { product: updated.rows[0], movement };
  });
  return res.status(201).json({ data });
});

productsRouter.get('/:productId/stock-movements', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const product = await query('SELECT id FROM products WHERE id = $1', [req.params.productId]);
  if (!product.rows[0]) throw new HttpError(404, 'Product not found.');
  const movements = await query(
    `SELECT m.id, m.quantity_changed AS "quantityChanged", m.movement_type AS "movementType", m.reason,
            m.reference_type AS "referenceType", m.reference_id AS "referenceId", m.created_at AS "createdAt", u.name AS "createdBy"
     FROM stock_movements m JOIN users u ON u.id = m.created_by
     WHERE m.product_id = $1 ORDER BY m.created_at DESC LIMIT $2 OFFSET $3`,
    [req.params.productId, limit, offset],
  );
  const count = await query<{ total: string }>('SELECT COUNT(*) AS total FROM stock_movements WHERE product_id = $1', [req.params.productId]);
  return res.json({ data: movements.rows, meta: { page, limit, total: Number(count.rows[0].total) } });
});
