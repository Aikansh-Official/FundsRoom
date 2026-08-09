import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { pool, withTransaction } from '../database/pool.js';

const password = 'FundsRoom@123';

const users = [
  { name: 'Aarav Mehta', email: 'admin@stockflow.test', role: 'ADMIN' },
  { name: 'Riya Kapoor', email: 'sales@stockflow.test', role: 'SALES' },
  { name: 'Kabir Shah', email: 'warehouse@stockflow.test', role: 'WAREHOUSE' },
  { name: 'Ananya Rao', email: 'accounts@stockflow.test', role: 'ACCOUNTS' },
] as const;

const customers = [
  ['Priya Sharma', '9876501234', 'priya@evergreenstores.in', 'Evergreen Stores', 'WHOLESALE', 'ACTIVE', '12 Market Road, Chandigarh', '03ABCPD1234E1ZQ'],
  ['Rahul Verma', '9811102233', 'rahul@urbanretail.in', 'Urban Retail Hub', 'RETAIL', 'LEAD', '55 Sector 18, Noida', null],
  ['Neha Gupta', '9899004411', 'neha@northstardistributors.in', 'Northstar Distributors', 'DISTRIBUTOR', 'ACTIVE', '8 Industrial Area, Ludhiana', '03AAGCN2200K1ZZ'],
] as const;

const products = [
  ['A4 Copier Paper - 75 GSM', 'PAP-A4-75', 'Stationery', 285, 42, 15, 'Main Warehouse'],
  ['Blue Ball Pen - Pack of 10', 'PEN-BLU-10', 'Writing', 95, 8, 10, 'Main Warehouse'],
  ['Hardbound Notebook - A5', 'NOTE-A5-HB', 'Stationery', 140, 26, 8, 'Shelf B-12'],
  ['Permanent Marker - Black', 'MARK-BLK-01', 'Writing', 55, 3, 6, 'Shelf C-04'],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  await withTransaction(async (client) => {
    for (const user of users) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
         ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role)`,
        [user.name, user.email, passwordHash, user.role],
      );
    }
    const warehouseUser = await client.query<{ id: string }>("SELECT id FROM users WHERE email = 'warehouse@stockflow.test'");
    for (const customer of customers) {
      await client.query(
        `INSERT INTO customers (customer_name, mobile, email, business_name, customer_type, status, address, gst_number, follow_up_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY))
         ON DUPLICATE KEY UPDATE customer_name = customer_name`, [...customer],
      );
    }
    for (const product of products) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO products (product_name, sku, category, unit_price, current_stock, minimum_stock_alert_quantity, warehouse_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON DUPLICATE KEY UPDATE sku = sku`, [...product],
      );
      const productId = inserted.rows[0]?.id ?? (await client.query<{ id: string }>('SELECT id FROM products WHERE sku = $1', [product[1]])).rows[0].id;
      const hasSeedMovement = await client.query<{ id: string }>(
        "SELECT id FROM stock_movements WHERE product_id = $1 AND reference_type = 'SEED' LIMIT 1", [productId],
      );
      if (!hasSeedMovement.rows[0]) {
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, reference_type, created_by)
           VALUES ($1,$2,'IN','Opening stock for demo product','SEED',$3)`,
          [productId, product[4], warehouseUser.rows[0].id],
        );
      }
    }
  });
  console.log(`Demo data is ready. Every test account uses password: ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
