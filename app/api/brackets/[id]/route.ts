import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BracketData } from "@/lib/bracket";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT user_id, data FROM brackets WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0];
  if (!row)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  const user = await getCurrentUser();
  return NextResponse.json({
    bracket: JSON.parse(String(row.data)),
    canEdit: user?.id === String(row.user_id),
  });
});

export const PUT = apiHandler(async (req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT user_id, data FROM brackets WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0];
  if (!row)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  if (String(row.user_id) !== user.id)
    return NextResponse.json({ error: "Not your bracket." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const incoming = body?.data as BracketData;
  const existing = JSON.parse(String(row.data)) as BracketData;
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
  await db.execute({
    sql: "UPDATE brackets SET name = ?, data = ?, updated_at = ? WHERE id = ?",
    args: [stored.name, JSON.stringify(stored), now, id],
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler(async (_req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = await getDb();
  const res = await db.execute({
    sql: "DELETE FROM brackets WHERE id = ? AND user_id = ?",
    args: [id, user.id],
  });
  if (res.rowsAffected === 0)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
});
