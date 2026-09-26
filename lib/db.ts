import { createClient, type Client } from "@libsql/client";
import path from "path";
import fs from "fs";

// On Vercel, set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) to a Turso/libSQL
// database. Without them we fall back to a local SQLite file for development.
function create(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Database not configured: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your Vercel environment variables, then redeploy."
    );
  }
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return createClient({ url: "file:" + path.join(dir, "bracketline.db") });
}

async function init(): Promise<Client> {
  const db = create();
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        username TEXT NOT NULL,
        pass_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS brackets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_brackets_user ON brackets(user_id)`,
    ],
    "write"
  );
  await migrate(db);
  return db;
}

/** Additive schema changes for databases created by an earlier version. */
async function migrate(db: Client) {
  const info = await db.execute("PRAGMA table_info(brackets)");
  const columns = new Set(info.rows.map((r) => String(r.name)));
  if (!columns.has("slug")) {
    await db.execute("ALTER TABLE brackets ADD COLUMN slug TEXT");
  }
  // NULLs don't collide in a SQLite unique index, so unslugged brackets are fine.
  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_brackets_slug ON brackets(slug)"
  );
}

let ready: Promise<Client> | null = null;

export function getDb(): Promise<Client> {
  if (!ready) ready = init();
  return ready;
}
