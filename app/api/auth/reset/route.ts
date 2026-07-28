import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import {
  consumeResetToken,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (!token)
    return NextResponse.json(
      { error: "This reset link is missing its token." },
      { status: 400 }
    );
  if (password.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );

  const userId = await consumeResetToken(token, password);
  if (!userId)
    return NextResponse.json(
      { error: "This reset link has expired or already been used." },
      { status: 400 }
    );

  // Sign them straight in on this device.
  await setSessionCookie(await createSession(userId));
  return NextResponse.json({ ok: true });
});
