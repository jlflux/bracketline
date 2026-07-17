"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type User = { id: string; email: string; username: string };

export default function AuthNav() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (user === undefined) return null;

  if (!user)
    return (
      <Link href="/login" className="btn small">
        Sign in
      </Link>
    );

  return (
    <button className="btn small ghost" onClick={logout} title={user.email}>
      {user.username} · Sign out
    </button>
  );
}
