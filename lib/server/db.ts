import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".pglite-data");

// Singleton — reuse across hot reloads in dev
const g = globalThis as typeof globalThis & {
  _pglite?: PGlite;
  _pgliteReady?: Promise<void>;
  _drizzle?: ReturnType<typeof drizzle<typeof schema>>;
};
type AppDb = ReturnType<typeof drizzle<typeof schema>>;

function readMigrations(): Array<{ tag: string; sql: string[] }> {
  const journalPath = path.join(process.cwd(), "db/migrations/meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.map((entry) => {
    const filePath = path.join(process.cwd(), "db/migrations", `${entry.tag}.sql`);
    const raw = fs.readFileSync(filePath, "utf-8");
    // Split on Drizzle's statement-breakpoint marker
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    return { tag: entry.tag, sql: statements };
  });
}

async function runMigrations(client: PGlite): Promise<void> {
  // Create migrations tracking table
  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      tag text NOT NULL UNIQUE,
      applied_at bigint
    );
  `);

  const applied = await client.query<{ tag: string }>(
    `SELECT tag FROM drizzle.__drizzle_migrations`
  );
  const appliedTags = new Set(applied.rows.map((r) => r.tag));

  const migrations = readMigrations();
  for (const migration of migrations) {
    if (appliedTags.has(migration.tag)) continue;
    for (const stmt of migration.sql) {
      await client.exec(stmt);
    }
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (tag, applied_at) VALUES ($1, $2)`,
      [migration.tag, Date.now()]
    );
  }
}

function initDb(): AppDb {
  if (g._drizzle) return g._drizzle;

  g._pglite = new PGlite(DATA_DIR);
  g._drizzle = drizzle(g._pglite, { schema });
  g._pgliteReady = runMigrations(g._pglite);

  return g._drizzle;
}

export const db = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    return Reflect.get(initDb(), prop, receiver);
  }
});

export async function getDb() {
  const database = initDb();
  await g._pgliteReady;
  return database;
}
