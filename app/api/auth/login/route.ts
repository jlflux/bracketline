import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, email, username, pass_hash FROM users WHERE email = ?",
    args: [email],
  });
  const row = res.rows[0];

  if (!row || !verifyPassword(password, String(row.pass_hash)))
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );

  await setSessionCookie(await createSession(String(row.id)));
  return NextResponse.json({
    user: {
      id: String(row.id),
      email: String(row.email),
      username: String(row.username),
    },
  });
}
