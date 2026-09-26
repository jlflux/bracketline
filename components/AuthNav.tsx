"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type User = { id: string; email: string; username: string };

export default function AuthNav() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [canCreate, setCanCreate] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setCanCreate(!!d.canCreate);
      })
      .catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (user === undefined) return null;

  return (
    <>
      {/* Only offered to accounts that can actually create one. */}
      {canCreate && (
        <Link href="/new" className="nav-link hide-mobile">
          New bracket
        </Link>
      )}
      <Link href="/dashboard" className="nav-link">
        My brackets
      </Link>
      {user ? (
        <button
          className="btn small ghost"
          onClick={logout}
          title={user.email}
        >
          {user.username} · Sign out
        </button>
      ) : (
        <Link href="/login" className="btn small">
          Sign in
        </Link>
      )}
    </>
  );
}
