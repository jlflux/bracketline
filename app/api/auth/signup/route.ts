import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { newId } from "@/lib/bracket";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (username.length < 2 || username.length > 30)
    return NextResponse.json(
      { error: "Username must be 2–30 characters." },
      { status: 400 }
    );
  if (password.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );

  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });
  if (existing.rows.length > 0)
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );

  const id = newId("u_");
  await db.execute({
    sql: "INSERT INTO users (id, email, username, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, email, username, hashPassword(password), Date.now()],
  });

  await setSessionCookie(await createSession(id));
  return NextResponse.json({ user: { id, email, username } });
});
