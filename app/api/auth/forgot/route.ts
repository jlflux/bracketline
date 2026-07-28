import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getDb } from "@/lib/db";
import { createResetToken } from "@/lib/auth";
import { originFrom, sendEmail } from "@/lib/email";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  if (!email)
    return NextResponse.json({ error: "Enter your email." }, { status: 400 });

  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, username FROM users WHERE email = ?",
    args: [email],
  });
  const row = res.rows[0];

  // Computed from config alone — never from whether the account exists.
  const configured = !!process.env.RESEND_API_KEY;
  if (row) {
    const token = await createResetToken(String(row.id));
    const link = `${originFrom(req)}/reset?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your Bracketline password",
      text: `Hi ${String(row.username)},

Use this link to choose a new password. It expires in one hour and can only be used once.

${link}

If you didn't ask to reset your password, you can ignore this email — nothing has changed.`,
      html: `<p>Hi ${escapeHtml(String(row.username))},</p>
<p>Use this link to choose a new password. It expires in one hour and can only be used once.</p>
<p><a href="${link}" style="display:inline-block;background:#0d9de8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="color:#5b6b80;font-size:13px">Or paste this into your browser:<br>${link}</p>
<p style="color:#5b6b80;font-size:13px">If you didn't ask to reset your password, you can ignore this email — nothing has changed.</p>`,
    });
  }

  // Always the same response shape, so this can't be used to discover which
  // emails have accounts.
  return NextResponse.json({ ok: true, emailConfigured: configured });
});

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );
}
