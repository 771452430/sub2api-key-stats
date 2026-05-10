import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined
    });
  }

  return pool;
}
