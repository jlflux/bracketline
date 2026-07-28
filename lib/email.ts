/**
 * Minimal transactional email via Resend's REST API (no SDK dependency).
 * When RESEND_API_KEY isn't set, the message is logged server-side instead
 * so the app still works — useful in development and before email is wired
 * up in production.
 */
export type SendResult = { delivered: boolean; error?: string };

export async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Never returned to the browser — server logs only.
    console.log(
      `[email] RESEND_API_KEY not set. Would send to ${msg.to}:\n${msg.text}`
    );
    return { delivered: false, error: "not_configured" };
  }

  const from = process.env.EMAIL_FROM || "Bracketline <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] Resend error", res.status, detail);
      return { delivered: false, error: `resend_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { delivered: false, error: "send_failed" };
  }
}

/** Absolute origin of the current request (works on any Vercel domain). */
export function originFrom(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
