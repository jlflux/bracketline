"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BracketView from "@/components/BracketView";
import {
  BracketData,
  computeBracket,
  hasProgress,
  participantCount,
  rearrange,
  swapSlots,
} from "@/lib/bracket";
import {
  deleteLocal,
  getLocal,
  isLocalId,
  saveLocal,
} from "@/lib/localBrackets";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

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
  const [seedEdit, setSeedEdit] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const local = isLocalId(id);

  useEffect(() => {
    fetch("/api/me")
      .then(readJson)
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
        })
          .then(async (r) => {
            if (!r.ok) {
              const body = await readJson(r);
              showToast(String(body.error ?? "Could not save"));
            }
          })
          .catch(() => showToast("Could not save — check your connection"));
      }, 500);
    },
    [id, local]
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  function onChange(next: BracketData) {
    setData(next);
    persist(next);
  }

  function confirmRearrange(): boolean {
    if (!data || !hasProgress(data)) return true;
    return confirm(
      "Re-arranging changes the matchups, so recorded scores and winners will be cleared (match locations and times are kept). Continue?"
    );
  }

  function arrange(mode: "seeded" | "random") {
    if (!data || !confirmRearrange()) return;
    setSeedEdit(false);
    onChange(rearrange(data, mode));
    showToast(mode === "seeded" ? "Arranged by seed" : "Random draw complete");
  }

  function startSeedEdit() {
    if (!data) return;
    if (!seedEdit && !confirmRearrange()) return;
    setSeedEdit(!seedEdit);
  }

  function onSwap(a: number, b: number) {
    if (!data) return;
    onChange(swapSlots(data, a, b));
  }

  async function saveToAccount() {
    if (!data) return;
    const res = await fetch("/api/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const body = await readJson(res);
    if (!res.ok) {
      showToast(String(body.error ?? "Could not save"));
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
        <h1>{data.name}</h1>
        {champion && (
          <span className="champion-banner">🏆 {champion.name} wins</span>
        )}
        <span className="hint">{participantCount(data)} players</span>
        {canEdit && (
          <button
            className={`btn small${panelOpen ? " primary" : ""}`}
            onClick={() => setPanelOpen(!panelOpen)}
          >
            Customize
          </button>
        )}
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
      </div>

      {canEdit && panelOpen && (
        <CustomizePanel
          data={data}
          seedEdit={seedEdit}
          onArrange={arrange}
          onToggleSeedEdit={startSeedEdit}
          onChange={onChange}
          onDelete={remove}
          onDone={() => {
            setPanelOpen(false);
            setSeedEdit(false);
          }}
        />
      )}

      {seedEdit ? (
        <div className="seed-edit-banner">
          <span>
            <strong>Custom placement:</strong> drag a player onto another to
            swap them — or tap one, then tap the other.
          </span>
          <button
            className="btn small primary"
            onClick={() => setSeedEdit(false)}
          >
            Done
          </button>
        </div>
      ) : panelOpen ? (
        <div className="seed-edit-banner">
          <span>
            <strong>Customize:</strong> click any matchup to edit the teams in
            it — seed and name.
          </span>
        </div>
      ) : (
        canEdit && (
          <p className="hint" style={{ margin: "0 0 12px" }}>
            Click any match to enter scores, pick a winner, or set a time and
            location.
          </p>
        )
      )}

      <BracketView
        data={data}
        editable={canEdit}
        onChange={onChange}
        seedEdit={seedEdit}
        onSwap={onSwap}
        teamEdit={panelOpen && !seedEdit}
      />
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function CustomizePanel({
  data,
  seedEdit,
  onArrange,
  onToggleSeedEdit,
  onChange,
  onDelete,
  onDone,
}: {
  data: BracketData;
  seedEdit: boolean;
  onArrange: (mode: "seeded" | "random") => void;
  onToggleSeedEdit: () => void;
  onChange: (next: BracketData) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(data.name);

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === data.name) {
      setName(data.name);
      return;
    }
    onChange({ ...data, name: trimmed.slice(0, 120), updatedAt: Date.now() });
  }

  return (
    <div className="card customize-panel">
      <div className="customize-section">
        <h2>Bracket name</h2>
        <input
          className="input"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Bracket name"
        />
      </div>

      <div className="customize-section">
        <h2>Placement</h2>
        <p className="hint" style={{ margin: "0 0 10px" }}>
          How players are arranged in the bracket. Re-arranging clears scores
          but keeps match locations and times.
        </p>
        <div className="placement-row">
          <button className="chip" onClick={() => onArrange("seeded")}>
            Seeded (1 vs lowest)
          </button>
          <button className="chip" onClick={() => onArrange("random")}>
            Random draw
          </button>
          <button
            className={`chip${seedEdit ? " active" : ""}`}
            onClick={onToggleSeedEdit}
          >
            Custom — drag &amp; drop
          </button>
        </div>
      </div>

      <div className="customize-footer">
        <button className="btn small ghost danger" onClick={onDelete}>
          Delete bracket
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn small primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
