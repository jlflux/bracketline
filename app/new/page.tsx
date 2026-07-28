"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BracketData,
  BracketFormat,
  MAX_GROUPS,
  MAX_GROUP_SIZE,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  buildSlots,
  distributeGroups,
  newId,
  qualifierPlaceholders,
} from "@/lib/bracket";
import { saveLocal } from "@/lib/localBrackets";

type Entry = { name: string; seed: string };

export default function NewBracketPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [count, setCount] = useState(8);
  const [entries, setEntries] = useState<Entry[]>(
    Array.from({ length: 8 }, () => ({ name: "", seed: "" }))
  );
  const [format, setFormat] = useState<BracketFormat>("single");
  const [groupsOn, setGroupsOn] = useState(false);
  const [groupCount, setGroupCount] = useState(2);
  const [advance, setAdvance] = useState(2);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => {});
  }, []);

  function resize(n: number) {
    const c = Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, n));
    setCount(c);
    setEntries((prev) => {
      const next = [...prev];
      while (next.length < c) next.push({ name: "", seed: "" });
      return next.slice(0, c);
    });
  }

  function update(i: number, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((e, j) => (j === i ? { ...e, ...patch } : e))
    );
  }

  function applyPaste() {
    const lines = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, MAX_PARTICIPANTS);
    if (lines.length < MIN_PARTICIPANTS) {
      setError(`Paste at least ${MIN_PARTICIPANTS} names, one per line.`);
      return;
    }
    setError("");
    setCount(lines.length);
    setEntries(lines.map((name) => ({ name, seed: "" })));
    setPasteOpen(false);
    setPasteText("");
  }

  async function create() {
    const title = name.trim() || "Untitled bracket";
    const participants = entries.map((e, i) => ({
      id: `p${i}`,
      name: e.name.trim() || `Player ${i + 1}`,
      seed: e.seed.trim() || String(i + 1),
    }));

    if (groupsOn) {
      const maxSize = Math.ceil(participants.length / groupCount);
      const minSize = Math.floor(participants.length / groupCount);
      if (minSize < 2) {
        setError(
          `${groupCount} groups need at least ${groupCount * 2} players (every group needs 2+).`
        );
        return;
      }
      if (maxSize > MAX_GROUP_SIZE) {
        setError(
          `Groups max out at ${MAX_GROUP_SIZE} players — use at least ${Math.ceil(
            participants.length / MAX_GROUP_SIZE
          )} groups for ${participants.length} players.`
        );
        return;
      }
      if (advance > minSize) {
        setError(
          `Can't advance top ${advance} from groups of ${minSize} — lower the advance count or use fewer groups.`
        );
        return;
      }
    }

    setBusy(true);
    setError("");
    const now = Date.now();
    const data: BracketData = {
      id: "",
      name: title,
      format,
      groupStage: groupsOn
        ? {
            advance,
            groups: distributeGroups(participants, groupCount),
            results: {},
            overrides: {},
          }
        : undefined,
      slots: groupsOn
        ? buildSlots(qualifierPlaceholders(groupCount, advance), "seeded")
        : buildSlots(participants, "seeded"),
      results: {},
      createdAt: now,
      updatedAt: now,
    };

    if (loggedIn) {
      try {
        const res = await fetch("/api/brackets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            body.error || `Could not save bracket (error ${res.status}).`
          );
        router.push(`/b/${body.id}`);
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save bracket.");
        setBusy(false);
        return;
      }
    }

    const id = newId("local-");
    saveLocal({ ...data, id });
    router.push(`/b/${id}`);
  }

  return (
    <main className="container">
      <h1 className="page-title">New bracket</h1>
      <div className="builder-grid">
        <div className="card builder-card">
          <h2>Details</h2>
          <div className="field">
            <label htmlFor="bname">Bracket name</label>
            <input
              id="bname"
              className="input"
              placeholder="Spring Invitational 2026"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="bcount">
              Participants ({MIN_PARTICIPANTS}–{MAX_PARTICIPANTS})
            </label>
            <div className="count-row">
              <input
                id="bcount"
                type="range"
                min={MIN_PARTICIPANTS}
                max={MAX_PARTICIPANTS}
                value={count}
                onChange={(e) => resize(Number(e.target.value))}
              />
              <input
                type="number"
                className="input count-badge"
                style={{ width: 74, border: "none" }}
                min={MIN_PARTICIPANTS}
                max={MAX_PARTICIPANTS}
                value={count}
                onChange={(e) => resize(Number(e.target.value) || count)}
              />
            </div>
          </div>
          <div className="field">
            <label>Format</label>
            <div className="placement-row">
              {(
                [
                  ["single", "Single elimination"],
                  ["double", "Double elimination"],
                ] as [BracketFormat, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip${format === value ? " active" : ""}`}
                  onClick={() => setFormat(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Group stage</label>
            <div className="placement-row">
              <button
                type="button"
                className={`chip${!groupsOn ? " active" : ""}`}
                onClick={() => setGroupsOn(false)}
              >
                Straight to bracket
              </button>
              <button
                type="button"
                className={`chip${groupsOn ? " active" : ""}`}
                onClick={() => setGroupsOn(true)}
              >
                Groups first
              </button>
            </div>
          </div>
          {groupsOn && (
            <div className="group-config">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="gcount">Groups</label>
                <select
                  id="gcount"
                  className="input"
                  value={groupCount}
                  onChange={(e) => setGroupCount(Number(e.target.value))}
                >
                  {Array.from({ length: MAX_GROUPS - 1 }, (_, i) => i + 2).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="gadv">Advance per group</label>
                <select
                  id="gadv"
                  className="input"
                  value={advance}
                  onChange={(e) => setAdvance(Number(e.target.value))}
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              </div>
              <p className="hint" style={{ gridColumn: "1 / -1", margin: 0 }}>
                {count} players → {groupCount} round-robin groups of{" "}
                {Math.ceil(count / groupCount)}
                {count % groupCount !== 0
                  ? `–${Math.floor(count / groupCount)}`
                  : ""}{" "}
                → {groupCount * advance} advance to the knockout. You can
                override who advances from each group later.
              </p>
            </div>
          )}
          <p className="hint" style={{ margin: 0 }}>
            Players start in seeded order (1 vs lowest). You can switch to a
            random draw or drag players anywhere from the bracket&apos;s
            Customize menu after creating it.
          </p>
        </div>

        <div className="card builder-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ flex: 1 }}>Participants</h2>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => setPasteOpen(!pasteOpen)}
            >
              {pasteOpen ? "Close paste" : "Paste a list"}
            </button>
          </div>
          {pasteOpen && (
            <div className="field">
              <textarea
                className="input"
                rows={6}
                placeholder={"One name per line…\nAlice\nBob\nCharlie"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                type="button"
                className="btn small"
                style={{ alignSelf: "flex-start" }}
                onClick={applyPaste}
              >
                Use these names
              </button>
            </div>
          )}
          <p className="hint" style={{ marginTop: 0 }}>
            Seeds can be anything — 1, 2, 3 or codes like E4, R3-2. Blank
            fields fill in automatically.
          </p>
          {entries.map((e, i) => (
            <div key={i} className="participant-row">
              <input
                className="input seed"
                placeholder={String(i + 1)}
                maxLength={20}
                value={e.seed}
                onChange={(ev) => update(i, { seed: ev.target.value })}
                aria-label={`Seed for participant ${i + 1}`}
              />
              <input
                className="input"
                placeholder={`Player ${i + 1}`}
                maxLength={80}
                value={e.name}
                onChange={(ev) => update(i, { name: ev.target.value })}
                aria-label={`Name of participant ${i + 1}`}
              />
            </div>
          ))}
        </div>

        {error && <p className="error-msg">{error}</p>}
        <div className="builder-footer">
          <button className="btn primary" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create bracket"}
          </button>
          <span className="hint">
            {loggedIn
              ? "Saved to your account."
              : "Saved in this browser — sign in to keep it in the cloud."}
          </span>
        </div>
      </div>
    </main>
  );
}
