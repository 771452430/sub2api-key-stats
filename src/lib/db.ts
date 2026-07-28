import { Pool } from "pg";

let sub2Pool: Pool | undefined;
let appPool: Pool | undefined;

function sslConfig(enabled: boolean) {
  return enabled ? { rejectUnauthorized: false } : undefined;
}

export function getSub2Pool() {
  const connectionString = process.env.SUB2API_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("SUB2API_DATABASE_URL is not configured");
  }

  if (!sub2Pool) {
    sub2Pool = new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: sslConfig(process.env.DATABASE_SSL === "true")
    });
  }

  return sub2Pool;
}

export function getAppPool() {
  if (!process.env.APP_DATABASE_URL) {
    throw new Error("APP_DATABASE_URL is not configured");
  }

  if (!appPool) {
    appPool = new Pool({
      connectionString: process.env.APP_DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: sslConfig(process.env.APP_DATABASE_SSL === "true")
    });
  }

  return appPool;
}

export function getPool() {
  return getSub2Pool();
}
