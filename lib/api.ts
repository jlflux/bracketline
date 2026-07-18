import { NextRequest, NextResponse } from "next/server";

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;

/** Wrap a route handler so unexpected errors come back as JSON instead of an
 *  HTML crash page (which breaks clients calling res.json()). */
export function apiHandler<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      console.error("API error:", err);
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
