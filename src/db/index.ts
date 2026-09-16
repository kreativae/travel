import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let initializedPool: Pool | undefined;
let initializedDb: ReturnType<typeof drizzle> | undefined;

function getPool() {
  if (initializedPool) return initializedPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  initializedPool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = initializedPool;
  }

  return initializedPool;
}

function getDb() {
  if (initializedDb) return initializedDb;

  initializedDb = drizzle(getPool());
  return initializedDb;
}

export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    return Reflect.get(getPool(), property);
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    return Reflect.get(getDb(), property);
  },
});
