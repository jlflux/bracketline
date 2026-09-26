import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteCtx = { params: Promise<{ id: string }> };

/** The team this viewer follows in this tournament. Personal to them. */
export const GET = apiHandler(async (_req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ participantId: null });
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT participant_id FROM favorites WHERE user_id = ? AND bracket_id = ?",
    args: [user.id, id],
  });
  const row = res.rows[0];
  return NextResponse.json({
    participantId: row ? String(row.participant_id) : null,
  });
});

export const POST = apiHandler(async (req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const participantId = body?.participantId;
  const db = await getDb();

  if (!participantId) {
    await db.execute({
      sql: "DELETE FROM favorites WHERE user_id = ? AND bracket_id = ?",
      args: [user.id, id],
    });
    return NextResponse.json({ participantId: null });
  }

  const pid = String(participantId).slice(0, 80);
  await db.execute({
    sql: `INSERT INTO favorites (user_id, bracket_id, participant_id, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, bracket_id)
          DO UPDATE SET participant_id = excluded.participant_id,
                        updated_at = excluded.updated_at`,
    args: [user.id, id, pid, Date.now()],
  });
  return NextResponse.json({ participantId: pid });
});
