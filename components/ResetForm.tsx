"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error || `Something went wrong (error ${res.status}).`
        );
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!token)
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Link not valid</h1>
          <p className="sub">
            This page needs a reset link from your email.{" "}
            <Link href="/forgot">Request a new one</Link>.
          </p>
        </div>
      </div>
    );

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Choose a new password</h1>
        <p className="sub">
          You&apos;ll be signed in right after. Any other devices will be
          signed out.
        </p>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <span className="hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            className="input"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}
