import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { query, withTransaction } from '../database/pool.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';
import { parsePagination } from '../utils/pagination.js';

const challanItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(challanItemSchema).min(1).superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({ code: 'custom', path: [index, 'productId'], message: 'Each product can appear only once in a challan.' });
      }
      seen.add(item.productId);
    });
  }),
});

type ProductSnapshot = {
  id: string;
  product_name: string;
  sku: string;
  unit_price: string;
  current_stock: number;
};

export const challansRouter = Router();
challansRouter.use(authenticate);

challansRouter.get('/', requireRoles('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional().safeParse(req.query.status).data;
  const result = await query(
    `SELECT c.id, c.challan_number AS "challanNumber", c.total_quantity AS "totalQuantity", c.status,
            c.created_at AS "createdAt", cu.customer_name AS "customerName", cu.business_name AS "businessName", u.name AS "createdBy"
     FROM challans c JOIN customers cu ON cu.id = c.customer_id JOIN users u ON u.id = c.created_by
     WHERE ($1 = '' OR c.challan_number LIKE CONCAT('%', $1, '%') OR cu.customer_name LIKE CONCAT('%', $1, '%') OR cu.business_name LIKE CONCAT('%', $1, '%'))
       AND ($2 IS NULL OR c.status = $2)
     ORDER BY c.created_at DESC LIMIT $3 OFFSET $4`,
    [search, status ?? null, limit, offset],
  );
  const count = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM challans c JOIN customers cu ON cu.id = c.customer_id
     WHERE ($1 = '' OR c.challan_number LIKE CONCAT('%', $1, '%') OR cu.customer_name LIKE CONCAT('%', $1, '%') OR cu.business_name LIKE CONCAT('%', $1, '%'))
       AND ($2 IS NULL OR c.status = $2)`,
    [search, status ?? null],
  );
  return res.json({ data: result.rows, meta: { page, limit, total: Number(count.rows[0].total) } });
});

challansRouter.get('/export.csv', requireRoles('ADMIN', 'SALES', 'ACCOUNTS'), async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional().safeParse(req.query.status).data;
  const result = await query<{
    challanNumber: string; customerName: string; businessName: string; status: string;
    totalQuantity: number; createdAt: string; createdBy: string;
  }>(
    `SELECT c.challan_number AS "challanNumber", cu.customer_name AS "customerName", cu.business_name AS "businessName",
            c.status, c.total_quantity AS "totalQuantity", c.created_at AS "createdAt", u.name AS "createdBy"
     FROM challans c JOIN customers cu ON cu.id = c.customer_id JOIN users u ON u.id = c.created_by
     WHERE ($1 = '' OR c.challan_number LIKE CONCAT('%', $1, '%') OR cu.customer_name LIKE CONCAT('%', $1, '%') OR cu.business_name LIKE CONCAT('%', $1, '%'))
       AND ($2 IS NULL OR c.status = $2) ORDER BY c.created_at DESC`,
    [search, status ?? null],
  );
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    // Prevent spreadsheet formula injection when a user-controlled name starts
    // with a formula trigger such as =, +, -, or @.
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  const header = ['Challan', 'Customer', 'Business', 'Status', 'Units', 'Created', 'Created by'];
  const lines = [header, ...result.rows.map((row) => [row.challanNumber, row.customerName, row.businessName, row.status, row.totalQuantity, row.createdAt, row.createdBy])]
    .map((line) => line.map(escape).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stockflow-challans.csv"');
  return res.send(`\uFEFF${lines.join('\n')}`);
});

challansRouter.post('/', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const input = createChallanSchema.parse(req.body);
  const data = await withTransaction(async (client) => {
    const customer = await client.query('SELECT id FROM customers WHERE id = $1', [input.customerId]);
    if (!customer.rows[0]) throw new HttpError(404, 'Customer not found.');

    const productIds = input.items.map((item) => item.productId).sort();
    const products = await client.query<ProductSnapshot>(
      `SELECT id, product_name, sku, unit_price, current_stock FROM products
       WHERE id IN (${productIds.map(() => '?').join(', ')}) LOCK IN SHARE MODE`, productIds,
    );
    if (products.rows.length !== productIds.length) throw new HttpError(404, 'One or more selected products no longer exist.');
    const productsById = new Map(products.rows.map((product) => [product.id, product]));
    const sequence = await client.query('INSERT INTO challan_sequence () VALUES ()');
    const sequenceNumber = Number((sequence.rows[0] as unknown as { insertId: number }).insertId);
    const challanNumber = `CH-${new Date().getFullYear()}-${sequenceNumber.toString().padStart(5, '0')}`;
    const totalQuantity = input.items.reduce((total, item) => total + item.quantity, 0);
    const challanId = randomUUID();

    await client.query(
      `INSERT INTO challans (id, challan_number, customer_id, total_quantity, created_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [challanId, challanNumber, input.customerId, totalQuantity, req.user!.id],
    );
    for (const item of input.items) {
      const product = productsById.get(item.productId)!;
      await client.query(
        `INSERT INTO challan_items (challan_id, product_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [challanId, product.id, product.product_name, product.sku, product.unit_price, item.quantity],
      );
    }
    return { id: challanId, challanNumber, status: 'DRAFT', totalQuantity };
  });
  return res.status(201).json({ data });
});

challansRouter.get('/:challanId', requireRoles('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), async (req, res) => {
  const challan = await query(
    `SELECT c.id, c.challan_number AS "challanNumber", c.total_quantity AS "totalQuantity", c.status,
            c.created_at AS "createdAt", c.confirmed_at AS "confirmedAt", cu.id AS "customerId", cu.customer_name AS "customerName",
            cu.business_name AS "businessName", u.name AS "createdBy"
     FROM challans c JOIN customers cu ON cu.id = c.customer_id JOIN users u ON u.id = c.created_by WHERE c.id = $1`,
    [req.params.challanId],
  );
  if (!challan.rows[0]) throw new HttpError(404, 'Challan not found.');
  const items = await query(
    `SELECT id, product_id AS "productId", product_name_snapshot AS "productName", sku_snapshot AS sku,
            unit_price_snapshot AS "unitPrice", quantity FROM challan_items WHERE challan_id = $1 ORDER BY product_name_snapshot`,
    [req.params.challanId],
  );
  return res.json({ data: { ...challan.rows[0], items: items.rows } });
});

challansRouter.get('/:challanId/pdf', requireRoles('ADMIN', 'SALES', 'ACCOUNTS'), async (req, res) => {
  const challan = await query<{
    id: string; challanNumber: string; totalQuantity: number; status: string; createdAt: string; confirmedAt: string | null;
    customerName: string; businessName: string; mobile: string; email: string | null; address: string; createdBy: string;
  }>(
    `SELECT c.id, c.challan_number AS "challanNumber", c.total_quantity AS "totalQuantity", c.status,
            c.created_at AS "createdAt", c.confirmed_at AS "confirmedAt", cu.customer_name AS "customerName",
            cu.business_name AS "businessName", cu.mobile, cu.email, cu.address, u.name AS "createdBy"
     FROM challans c JOIN customers cu ON cu.id = c.customer_id JOIN users u ON u.id = c.created_by
     WHERE c.id = $1`, [req.params.challanId],
  );
  if (!challan.rows[0]) throw new HttpError(404, 'Challan not found.');
  const items = await query<{ productName: string; sku: string; unitPrice: number; quantity: number }>(
    `SELECT product_name_snapshot AS "productName", sku_snapshot AS sku, unit_price_snapshot AS "unitPrice", quantity
     FROM challan_items WHERE challan_id = $1 ORDER BY product_name_snapshot`, [req.params.challanId],
  );
  const record = challan.rows[0];
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${record.challanNumber}.pdf"`);
  doc.pipe(res);
  doc.fontSize(24).fillColor('#263a34').text('STOCKFLOW', { continued: true }).fontSize(11).fillColor('#6d665f').text('  |  SALES CHALLAN', { align: 'right' });
  doc.moveDown(1.5).fontSize(20).fillColor('#252322').text(record.challanNumber);
  doc.fontSize(10).fillColor('#6d665f').text(`Created ${new Date(record.createdAt).toLocaleDateString()}  ·  ${record.status}`);
  doc.moveDown();
  doc.fontSize(11).fillColor('#252322').text('Bill to', { underline: true });
  doc.fontSize(11).text(record.customerName).text(record.businessName).fontSize(10).fillColor('#6d665f').text(record.mobile).text(record.email ?? '').text(record.address);
  doc.moveDown(1.4);
  doc.fillColor('#263a34').fontSize(10).text('ITEM', 50, doc.y).text('SKU', 300, doc.y).text('QTY', 400, doc.y).text('UNIT PRICE', 455, doc.y);
  doc.moveTo(48, doc.y + 5).lineTo(547, doc.y + 5).strokeColor('#e4ded5').stroke();
  doc.moveDown(.7);
  let total = 0;
  items.rows.forEach((item) => {
    const line = Number(item.unitPrice) * Number(item.quantity); total += line;
    const y = doc.y;
    doc.fillColor('#252322').fontSize(10).text(item.productName, 50, y, { width: 235 }).text(item.sku, 300, y).text(String(item.quantity), 405, y).text(`₹${line.toFixed(2)}`, 455, y);
    doc.moveDown(.8);
  });
  doc.moveTo(360, doc.y + 4).lineTo(547, doc.y + 4).strokeColor('#d7d0c6').stroke();
  doc.moveDown(.8).fontSize(12).fillColor('#252322').text(`Total units: ${record.totalQuantity}`, 360, doc.y, { width: 187, align: 'right' }).text(`Total value: ₹${total.toFixed(2)}`, 360, doc.y, { width: 187, align: 'right' });
  doc.moveDown(3).fontSize(9).fillColor('#857e76').text(`Prepared by ${record.createdBy}. This document reflects the product and price snapshot saved with the challan.`);
  doc.end();
});

challansRouter.patch('/:challanId/confirm', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const data = await withTransaction(async (client) => {
    const challan = await client.query<{ id: string; challan_number: string; status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' }>(
      'SELECT id, challan_number, status FROM challans WHERE id = $1 FOR UPDATE', [req.params.challanId],
    );
    const current = challan.rows[0];
    if (!current) throw new HttpError(404, 'Challan not found.');
    if (current.status !== 'DRAFT') throw new HttpError(409, `Only a draft challan can be confirmed. This challan is ${current.status.toLowerCase()}.`);

    const items = await client.query<{ product_id: string; quantity: number }>(
      'SELECT product_id, quantity FROM challan_items WHERE challan_id = $1', [current.id],
    );
    const productIds = items.rows.map((item) => item.product_id).sort();
    const products = await client.query<ProductSnapshot>(
      `SELECT id, product_name, sku, unit_price, current_stock FROM products
       WHERE id IN (${productIds.map(() => '?').join(', ')}) FOR UPDATE`, productIds,
    );
    if (products.rows.length !== productIds.length) throw new HttpError(409, 'A product in this challan was deleted and cannot be confirmed.');
    const productsById = new Map(products.rows.map((product) => [product.id, product]));

    for (const item of items.rows) {
      const product = productsById.get(item.product_id)!;
      if (product.current_stock < item.quantity) {
        throw new HttpError(409, `Insufficient stock for ${product.product_name}. Available: ${product.current_stock}, requested: ${item.quantity}.`);
      }
    }
    for (const item of items.rows) {
      await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, reference_type, reference_id, created_by)
         VALUES ($1,$2,'OUT',$3,'CHALLAN',$4,$5)`,
        [item.product_id, item.quantity, `Confirmed sales challan ${current.challan_number}`, current.id, req.user!.id],
      );
    }
    await client.query(`UPDATE challans SET status = 'CONFIRMED', confirmed_at = NOW() WHERE id = $1`, [current.id]);
    return (await client.query('SELECT id, challan_number AS "challanNumber", status, confirmed_at AS "confirmedAt" FROM challans WHERE id = $1', [current.id])).rows[0];
  });
  return res.json({ data });
});

challansRouter.patch('/:challanId/cancel', requireRoles('ADMIN', 'SALES'), async (req, res) => {
  const result = await query(`UPDATE challans SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = $1 AND status = 'DRAFT'`, [req.params.challanId]);
  if ((result.rows[0] as unknown as { affectedRows: number }).affectedRows === 0) throw new HttpError(409, 'Only a draft challan can be cancelled, or this challan does not exist.');
  const cancelled = await query('SELECT id, challan_number AS "challanNumber", status, cancelled_at AS "cancelledAt" FROM challans WHERE id = $1', [req.params.challanId]);
  return res.json({ data: cancelled.rows[0] });
});
