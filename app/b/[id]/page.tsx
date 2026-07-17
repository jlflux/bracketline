"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BracketView from "@/components/BracketView";
import { BracketData, computeBracket, participantCount } from "@/lib/bracket";
import {
  deleteLocal,
  getLocal,
  isLocalId,
  saveLocal,
} from "@/lib/localBrackets";

export default function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<BracketData | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const local = isLocalId(id);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (local) {
      const b = getLocal(id);
      if (!b) setNotFound(true);
      else {
        setData(b);
        setCanEdit(true);
      }
      return;
    }
    fetch(`/api/brackets/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setData(d.bracket);
        setCanEdit(d.canEdit);
      })
      .catch(() => setNotFound(true));
  }, [id, local]);

  const persist = useCallback(
    (next: BracketData) => {
      if (local) {
        saveLocal(next);
        return;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/brackets/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: next }),
        }).catch(() => showToast("Could not save — check your connection"));
      }, 500);
    },
    [id, local]
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  function onChange(next: BracketData) {
    setData(next);
    persist(next);
  }

  function renameBracket() {
    if (!data) return;
    const name = prompt("Bracket name", data.name);
    if (name === null || !name.trim()) return;
    onChange({ ...data, name: name.trim().slice(0, 120), updatedAt: Date.now() });
  }

  async function saveToAccount() {
    if (!data) return;
    const res = await fetch("/api/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const body = await res.json();
    if (!res.ok) {
      showToast(body.error || "Could not save");
      return;
    }
    deleteLocal(id);
    router.replace(`/b/${body.id}`);
  }

  async function remove() {
    if (!data) return;
    if (!confirm(`Delete “${data.name}”? This cannot be undone.`)) return;
    if (local) deleteLocal(id);
    else await fetch(`/api/brackets/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  function share() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => showToast("Link copied"))
      .catch(() => showToast(window.location.href));
  }

  if (notFound)
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Bracket not found</h2>
          <p>
            It may have been deleted, or it lives in a different browser.{" "}
            <a href="/new">Create a new one</a>.
          </p>
        </div>
      </main>
    );

  if (!data) return null;

  const champion = computeBracket(data).champion;

  return (
    <main className="container" style={{ maxWidth: 1400 }}>
      <div className="bracket-toolbar">
        <h1>
          {data.name}{" "}
          {canEdit && (
            <button
              className="btn small ghost"
              onClick={renameBracket}
              aria-label="Rename bracket"
            >
              Rename
            </button>
          )}
        </h1>
        {champion && (
          <span className="champion-banner">
            🏆 {champion.name} wins
          </span>
        )}
        <span className="hint">{participantCount(data)} players</span>
        {!local && (
          <button className="btn small" onClick={share}>
            Share
          </button>
        )}
        {local && loggedIn && (
          <button className="btn small primary" onClick={saveToAccount}>
            Save to account
          </button>
        )}
        {local && !loggedIn && (
          <a className="btn small" href={`/signup?next=/b/${id}`}>
            Sign up to save
          </a>
        )}
        {canEdit && (
          <button className="btn small ghost danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>
      {canEdit && (
        <p className="hint" style={{ margin: "0 0 12px" }}>
          Click any match to enter scores or pick a winner.
        </p>
      )}
      <BracketView data={data} editable={canEdit} onChange={onChange} />
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
