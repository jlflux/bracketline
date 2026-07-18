import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
});
