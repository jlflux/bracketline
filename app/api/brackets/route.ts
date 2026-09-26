import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { canCreateBrackets, getCurrentUser } from "@/lib/auth";
import {
  BracketData,
  newId,
  participantCount,
  MIN_PARTICIPANTS,
  MAX_PARTICIPANTS,
} from "@/lib/bracket";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, name, data, slug FROM brackets WHERE user_id = ? ORDER BY updated_at DESC",
    args: [user.id],
  });
  const brackets = res.rows.map((r: Record<string, unknown>) => {
    const data = JSON.parse(String(r.data)) as BracketData;
    return {
      id: String(r.id),
      name: String(r.name),
      slug: r.slug ? String(r.slug) : null,
      participants: participantCount(data),
      updatedAt: data.updatedAt,
    };
  });
  return NextResponse.json({ brackets });
});

function validSlots(
  slots: unknown,
  groupFed: boolean
): slots is (unknown | null)[] {
  if (!Array.isArray(slots)) return false;
  const size = slots.length;
  if (size < 2 || size > 256 || (size & (size - 1)) !== 0) return false;
  // A bracket fed by a group stage can have as few as 2 qualifier slots.
  const n = slots.filter(Boolean).length;
  const min = groupFed ? 2 : MIN_PARTICIPANTS;
  if (n < min || n > MAX_PARTICIPANTS) return false;
  for (const s of slots) {
    if (s === null) continue;
    const p = s as { name?: unknown; seed?: unknown };
    if (typeof p.name !== "string" || typeof p.seed !== "string") return false;
    if (p.name.length > 80 || p.seed.length > 20) return false;
  }
  return true;
}

function validate(data: unknown): data is BracketData {
  const d = data as BracketData;
  if (!d || typeof d !== "object") return false;
  if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 120)
    return false;

  const groupFed = !!d.groupStage;
  const knockouts = d.knockouts;
  if (knockouts !== undefined) {
    if (!Array.isArray(knockouts) || knockouts.length === 0) return false;
    if (knockouts.length > 8) return false;
    for (const k of knockouts) {
      if (!k || typeof k.name !== "string" || k.name.length > 40) return false;
      if (!validSlots(k.slots, groupFed)) return false;
      if (typeof k.results !== "object" || k.results === null) return false;
    }
  } else if (!validSlots(d.slots, groupFed)) {
    return false;
  }
  if (d.groupStage) {
    const g = d.groupStage;
    if (!Array.isArray(g.groups) || g.groups.length < 2) return false;
    const total = g.groups.reduce(
      (s: number, grp: unknown) => s + (Array.isArray(grp) ? grp.length : 0),
      0
    );
    if (total < MIN_PARTICIPANTS || total > MAX_PARTICIPANTS) return false;
    if (
      typeof g.advance !== "number" ||
      g.advance < 1 ||
      g.advance > 8
    )
      return false;
  }
  return true;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canCreateBrackets(user))
    return NextResponse.json(
      { error: "Creating tournaments isn't enabled for your account yet." },
      { status: 403 }
    );
  const body = await req.json().catch(() => null);
  const data = body?.data as BracketData;
  if (!validate(data))
    return NextResponse.json({ error: "Invalid bracket." }, { status: 400 });

  const db = await getDb();
  const id = newId();
  const now = Date.now();
  const stored: BracketData = { ...data, id, createdAt: now, updatedAt: now };
  await db.execute({
    sql: "INSERT INTO brackets (id, user_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, user.id, stored.name.trim(), JSON.stringify(stored), now, now],
  });
  return NextResponse.json({ id });
});
