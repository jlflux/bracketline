"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error || `Something went wrong (error ${res.status}).`
        );
      setEmailConfigured(body.emailConfigured !== false);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Check your email</h1>
          <p className="sub">
            If an account exists for <strong>{email}</strong>, a reset link is
            on its way. It expires in one hour.
          </p>
          {!emailConfigured && (
            <p className="notice">
              Email delivery isn&apos;t set up on this site yet, so the reset
              link was written to the server logs instead. Add a{" "}
              <code>RESEND_API_KEY</code> environment variable to send real
              emails.
            </p>
          )}
          <Link className="btn" href="/login" style={{ width: "100%" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Reset your password</h1>
        <p className="sub">
          Enter the email you signed up with and we&apos;ll send you a link to
          choose a new password.
        </p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
