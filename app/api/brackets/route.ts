import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  BracketData,
  newId,
  participantCount,
  MIN_PARTICIPANTS,
  MAX_PARTICIPANTS,
} from "@/lib/bracket";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const rows = db
    .prepare(
      "SELECT id, name, data, created_at, updated_at FROM brackets WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(user.id) as { id: string; name: string; data: string }[];
  const brackets = rows.map((r) => {
    const data = JSON.parse(r.data) as BracketData;
    return {
      id: r.id,
      name: r.name,
      participants: participantCount(data),
      updatedAt: data.updatedAt,
    };
  });
  return NextResponse.json({ brackets });
}

function validate(data: unknown): data is BracketData {
  const d = data as BracketData;
  if (!d || typeof d !== "object") return false;
  if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 120)
    return false;
  if (!Array.isArray(d.slots)) return false;
  const size = d.slots.length;
  if (size < 4 || size > 256 || (size & (size - 1)) !== 0) return false;
  const n = d.slots.filter(Boolean).length;
  if (n < MIN_PARTICIPANTS || n > MAX_PARTICIPANTS) return false;
  for (const s of d.slots) {
    if (s === null) continue;
    if (typeof s.name !== "string" || typeof s.seed !== "string") return false;
    if (s.name.length > 80 || s.seed.length > 20) return false;
  }
  if (typeof d.results !== "object" || d.results === null) return false;
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const data = body?.data as BracketData;
  if (!validate(data))
    return NextResponse.json({ error: "Invalid bracket." }, { status: 400 });

  const id = newId();
  const now = Date.now();
  const stored: BracketData = { ...data, id, createdAt: now, updatedAt: now };
  db.prepare(
    "INSERT INTO brackets (id, user_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, user.id, stored.name.trim(), JSON.stringify(stored), now, now);
  return NextResponse.json({ id });
}
