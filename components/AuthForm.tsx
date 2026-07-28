"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error || `Something went wrong (error ${res.status}).`
        );
      const next = search.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="sub">
          {isSignup
            ? "Keep your brackets saved and synced everywhere."
            : "Sign in to your saved brackets."}
        </p>
        {isSignup && (
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              value={username}
              maxLength={30}
              required
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            required
            minLength={isSignup ? 8 : 1}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          {isSignup ? (
            <span className="hint">At least 8 characters.</span>
          ) : (
            <Link href="/forgot" className="hint forgot-link">
              Forgot your password?
            </Link>
          )}
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button
          className="btn primary"
          style={{ width: "100%" }}
          disabled={busy}
        >
          {busy ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </button>
        <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
          {isSignup ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Create an account</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
