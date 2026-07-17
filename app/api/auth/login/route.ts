import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  const row = db
    .prepare(
      "SELECT id, email, username, pass_hash FROM users WHERE email = ?"
    )
    .get(email) as
    | { id: string; email: string; username: string; pass_hash: string }
    | undefined;

  if (!row || !verifyPassword(password, row.pass_hash))
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );

  await setSessionCookie(createSession(row.id));
  return NextResponse.json({
    user: { id: row.id, email: row.email, username: row.username },
  });
}
