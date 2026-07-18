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
  return db;
}

let ready: Promise<Client> | null = null;

export function getDb(): Promise<Client> {
  if (!ready) ready = init();
  return ready;
}
