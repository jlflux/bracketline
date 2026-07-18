import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { clearSession } from "@/lib/auth";

export const POST = apiHandler(async () => {
  await clearSession();
  return NextResponse.json({ ok: true });
});
