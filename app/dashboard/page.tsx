"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listLocal } from "@/lib/localBrackets";

type Item = {
  id: string;
  name: string;
  participants: number;
  updatedAt: number;
  local: boolean;
};

export default function DashboardPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const locals: Item[] = listLocal().map((b) => ({ ...b, local: true }));
    fetch("/api/brackets")
      .then(async (r) => {
        if (r.status === 401) return { brackets: [], anon: true };
        return r.json();
      })
      .then((d: { brackets?: Omit<Item, "local">[]; anon?: boolean }) => {
        setLoggedIn(!d.anon);
        const cloud: Item[] = (d.brackets ?? []).map((b) => ({
          ...b,
          local: false,
        }));
        setItems(
          [...cloud, ...locals].sort((a, b) => b.updatedAt - a.updatedAt)
        );
      })
      .catch(() => setItems(locals));
  }, []);

  if (items === null) return null;

  return (
    <main className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="page-title" style={{ flex: 1 }}>
          My brackets
        </h1>
        <Link href="/new" className="btn primary small">
          New bracket
        </Link>
      </div>

      {!loggedIn && items.length > 0 && (
        <p className="hint" style={{ margin: "0 0 18px" }}>
          These brackets are stored in this browser only.{" "}
          <Link href="/signup">Create an account</Link> to keep them safe in
          the cloud.
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>No brackets yet</h2>
          <p>
            Your tournaments will show up here.{" "}
            <Link href="/new">Create your first bracket</Link>
            {!loggedIn && (
              <>
                {" "}
                or <Link href="/login">sign in</Link> to see saved ones
              </>
            )}
            .
          </p>
        </div>
      ) : (
        <div className="bracket-list">
          {items.map((b) => (
            <Link key={b.id} href={`/b/${b.id}`} className="card bracket-tile">
              <span className={`tile-badge ${b.local ? "local" : "cloud"}`}>
                {b.local ? "This browser" : "Saved"}
              </span>
              <h3>{b.name}</h3>
              <span className="meta">
                {b.participants} players · updated{" "}
                {new Date(b.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
