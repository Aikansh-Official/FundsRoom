import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../database/pool.js';

type Lookup = { id: string };
type Product = { id: string; product_name: string; sku: string; unit_price: string; current_stock: number };

const users = ['sales@stockflow.test', 'admin@stockflow.test', 'accounts@stockflow.test'];
const customerNames = ['Priya Sharma', 'Rahul Verma', 'Neha Gupta'];
const productSkus = ['PAP-A4-75', 'PEN-BLU-10', 'NOTE-A5-HB', 'MARK-BLK-01'];

function dateStamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timestamp(date: Date, hour: number, minute: number) {
  return `${dateStamp(date)} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

async function main() {
  const result = await withTransaction(async (client) => {
    const existing = await client.query<{ total: string }>("SELECT COUNT(*) AS total FROM challans WHERE challan_number LIKE 'DEMO10-%'");
    if (Number(existing.rows[0].total) > 0) {
      // Keep one product below its alert threshold so the notification and low-stock views remain testable.
      const marker = (await client.query<{ id: string; current_stock: number; minimum_stock_alert_quantity: number }>("SELECT id, current_stock, minimum_stock_alert_quantity FROM products WHERE sku = 'MARK-BLK-01'")).rows[0];
      const warehouse = (await client.query<Lookup>("SELECT id FROM users WHERE email = 'warehouse@stockflow.test'")).rows[0];
      if (marker && warehouse && marker.current_stock > marker.minimum_stock_alert_quantity) {
        const quantity = marker.current_stock - marker.minimum_stock_alert_quantity;
        await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [quantity, marker.id]);
        await client.query(
          `INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, reference_type, created_by)
           VALUES ($1,$2,$3,'OUT','Demo low-stock notification check','DEMO10-LOWSTOCK',$4)`,
          [randomUUID(), marker.id, quantity, warehouse.id],
        );
      }
      return { skipped: true, challans: 0 };
    }

    const userIds = new Map<string, string>();
    for (const email of users) {
      const row = await client.query<Lookup>('SELECT id FROM users WHERE email = $1', [email]);
      if (!row.rows[0]) throw new Error(`Missing demo user ${email}. Run npm run db:seed first.`);
      userIds.set(email, row.rows[0].id);
    }
    const customerIds = new Map<string, string>();
    for (const name of customerNames) {
      const row = await client.query<Lookup>('SELECT id FROM customers WHERE customer_name = $1', [name]);
      if (!row.rows[0]) throw new Error(`Missing demo customer ${name}. Run npm run db:seed first.`);
      customerIds.set(name, row.rows[0].id);
    }
    const products = new Map<string, Product>();
    for (const sku of productSkus) {
      const row = await client.query<Product>('SELECT id, product_name, sku, unit_price, current_stock FROM products WHERE sku = $1', [sku]);
      if (!row.rows[0]) throw new Error(`Missing demo product ${sku}. Run npm run db:seed first.`);
      products.set(sku, row.rows[0]);
    }

    const warehouseUser = (await client.query<Lookup>("SELECT id FROM users WHERE email = 'warehouse@stockflow.test'")).rows[0];
    if (!warehouseUser) throw new Error('Missing warehouse demo user. Run npm run db:seed first.');

    // Add a dated receipt first so the ten days of outgoing sales never make local stock negative.
    for (const [index, sku] of productSkus.entries()) {
      const product = products.get(sku)!;
      const receipt = 18 + index * 4;
      const receiptDate = new Date(); receiptDate.setDate(receiptDate.getDate() - 11);
      await client.query('UPDATE products SET current_stock = current_stock + $1 WHERE id = $2', [receipt, product.id]);
      await client.query(
        `INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, reference_type, created_by, created_at)
         VALUES ($1,$2,$3,'IN','Demo history opening receipt','DEMO10',$4,$5)`,
        [randomUUID(), product.id, receipt, warehouseUser.id, timestamp(receiptDate, 8, 45)],
      );
    }

    const today = new Date();
    let challanCount = 0;
    for (let day = 0; day < 10; day += 1) {
      const saleDate = new Date(today); saleDate.setDate(today.getDate() - (9 - day));
      for (let order = 0; order < 2; order += 1) {
        const userEmail = users[(day + order) % users.length];
        const customerName = customerNames[(day + order) % customerNames.length];
        const sku = productSkus[(day * 2 + order) % productSkus.length];
        const product = products.get(sku)!;
        const quantity = 1 + ((day + order) % 3);
        const id = randomUUID();
        const challanNumber = `DEMO10-${dateStamp(saleDate).replaceAll('-', '')}-${String(order + 1).padStart(2, '0')}`;
        const createdAt = timestamp(saleDate, 9 + order, 15);
        const confirmedAt = timestamp(saleDate, 10 + order, 5);
        await client.query(
          `INSERT INTO challans (id, challan_number, customer_id, total_quantity, status, created_by, confirmed_at, created_at)
           VALUES ($1,$2,$3,$4,'CONFIRMED',$5,$6,$7)`,
          [id, challanNumber, customerIds.get(customerName), quantity, userIds.get(userEmail), confirmedAt, createdAt],
        );
        await client.query(
          `INSERT INTO challan_items (id, challan_id, product_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [randomUUID(), id, product.id, product.product_name, product.sku, product.unit_price, quantity],
        );
        await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [quantity, product.id]);
        await client.query(
          `INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, reference_type, reference_id, created_by, created_at)
           VALUES ($1,$2,$3,'OUT',$4,'DEMO10',$5,$6,$7)`,
          [randomUUID(), product.id, quantity, `Demo sale ${challanNumber}`, id, userIds.get(userEmail), confirmedAt],
        );
        challanCount += 1;
      }
    }

    const hasDemoQueries = await client.query<{ total: string }>("SELECT COUNT(*) AS total FROM customer_queries WHERE subject = 'Demo 10-day delivery question'");
    if (Number(hasDemoQueries.rows[0].total) === 0) {
      const salesUser = userIds.get('sales@stockflow.test')!;
      for (const [index, customerName] of customerNames.entries()) {
        const date = new Date(); date.setDate(date.getDate() - (index + 1));
        await client.query(
          `INSERT INTO customer_queries (id, customer_id, subject, message, status, priority, created_by, created_at)
           VALUES ($1,$2,'Demo 10-day delivery question',$3,$4,$5,$6,$7)`,
          [randomUUID(), customerIds.get(customerName), `Demo request from ${customerName}: can the next order be delivered this week?`, index === 2 ? 'RESOLVED' : 'OPEN', index === 0 ? 'HIGH' : 'MEDIUM', salesUser, timestamp(date, 14, 0)],
        );
      }
    }
    const hasDemoReviews = await client.query<{ total: string }>("SELECT COUNT(*) AS total FROM customer_reviews WHERE review = 'Demo 10-day service review'");
    if (Number(hasDemoReviews.rows[0].total) === 0) {
      const salesUser = userIds.get('sales@stockflow.test')!;
      await client.query(
        `INSERT INTO customer_reviews (id, customer_id, rating, review, created_by, created_at)
         VALUES ($1,$2,5,'Demo 10-day service review',$3,$4)`,
        [randomUUID(), customerIds.get('Priya Sharma'), salesUser, timestamp(new Date(), 11, 30)],
      );
    }
    return { skipped: false, challans: challanCount };
  });

  console.log(result.skipped ? 'Ten-day demo history already exists; nothing duplicated.' : `Created ${result.challans} confirmed challans across ten days, with stock and CRM activity.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
