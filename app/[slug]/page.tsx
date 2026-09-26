import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BracketPage from "@/components/BracketPage";
import { getDb } from "@/lib/db";
import { validateSlug } from "@/lib/slug";

/**
 * Custom links live at the root — /blalock2026. Next matches the app's own
 * routes (/new, /login, …) before this one, and reserved words are refused
 * when a link is created, so a slug can never shadow a real page.
 */
async function lookup(slug: string): Promise<{ id: string; name: string } | null> {
  if (!validateSlug(slug.toLowerCase()).ok) return null;
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, name FROM brackets WHERE slug = ?",
    args: [slug.toLowerCase()],
  });
  const row = res.rows[0];
  return row ? { id: String(row.id), name: String(row.name) } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hit = await lookup(slug);
  return hit
    ? { title: `${hit.name} — Bracketline` }
    : { title: "Not found — Bracketline" };
}

export default async function SlugRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hit = await lookup(slug);
  if (!hit) notFound();
  return <BracketPage id={hit.id} />;
}
