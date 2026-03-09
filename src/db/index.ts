import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import 'dotenv/config';

console.log('🔌 Connecting to database...');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

const db = drizzle({ client: pool });

// Test query
try {
  await db.execute('select 1');
  console.log('✅ Database test query successful');
} catch (error) {
  console.error('❌ Database test query failed:', error);
  throw error;
}

export default db;