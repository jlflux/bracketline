import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { newId } from "@/lib/bracket";

export async function POST(req: NextRequest) {
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

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existing)
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );

  const id = newId("u_");
  db.prepare(
    "INSERT INTO users (id, email, username, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, email, username, hashPassword(password), Date.now());

  await setSessionCookie(createSession(id));
  return NextResponse.json({ user: { id, email, username } });
}
