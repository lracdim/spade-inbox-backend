import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import 'dotenv/config';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export { schema };
