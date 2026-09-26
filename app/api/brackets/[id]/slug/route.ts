import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { validateSlug } from "@/lib/slug";

type RouteCtx = { params: Promise<{ id: string }> };

/** Set or clear a bracket's custom link. Admin-only for now. */
export const POST = apiHandler(async (req: NextRequest, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json(
      { error: "Custom links aren't available on your account." },
      { status: 403 }
    );

  const db = await getDb();
  const owner = await db.execute({
    sql: "SELECT user_id FROM brackets WHERE id = ?",
    args: [id],
  });
  if (owner.rows.length === 0)
    return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
  if (String(owner.rows[0].user_id) !== user.id)
    return NextResponse.json({ error: "Not your bracket." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const raw = body?.slug;

  // An empty value removes the custom link.
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    await db.execute({
      sql: "UPDATE brackets SET slug = NULL WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ slug: null });
  }

  const slug = String(raw).trim().toLowerCase();
  const check = validateSlug(slug);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const taken = await db.execute({
    sql: "SELECT id FROM brackets WHERE slug = ? AND id != ?",
    args: [slug, id],
  });
  if (taken.rows.length > 0)
    return NextResponse.json(
      { error: `"${slug}" is already in use.` },
      { status: 409 }
    );

  await db.execute({
    sql: "UPDATE brackets SET slug = ? WHERE id = ?",
    args: [slug, id],
  });
  return NextResponse.json({ slug });
});
