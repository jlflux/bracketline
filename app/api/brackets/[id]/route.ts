import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BracketData } from "@/lib/bracket";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const row = db
    .prepare("SELECT user_id, data FROM brackets WHERE id = ?")
    .get(id) as { user_id: string; data: string } | undefined;
  if (!row)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  const user = await getCurrentUser();
  return NextResponse.json({
    bracket: JSON.parse(row.data),
    canEdit: user?.id === row.user_id,
  });
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const row = db
    .prepare("SELECT user_id, data FROM brackets WHERE id = ?")
    .get(id) as { user_id: string; data: string } | undefined;
  if (!row)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  if (row.user_id !== user.id)
    return NextResponse.json({ error: "Not your bracket." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const incoming = body?.data as BracketData;
  const existing = JSON.parse(row.data) as BracketData;
  if (
    !incoming ||
    !Array.isArray(incoming.slots) ||
    incoming.slots.length !== existing.slots.length ||
    typeof incoming.name !== "string" ||
    !incoming.name.trim()
  )
    return NextResponse.json({ error: "Invalid bracket." }, { status: 400 });

  const now = Date.now();
  const stored: BracketData = {
    ...existing,
    name: incoming.name.trim().slice(0, 120),
    slots: incoming.slots,
    results: incoming.results ?? {},
    updatedAt: now,
  };
  db.prepare(
    "UPDATE brackets SET name = ?, data = ?, updated_at = ? WHERE id = ?"
  ).run(stored.name, JSON.stringify(stored), now, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const res = db
    .prepare("DELETE FROM brackets WHERE id = ? AND user_id = ?")
    .run(id, user.id);
  if (res.changes === 0)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
