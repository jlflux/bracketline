"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BracketView from "@/components/BracketView";
import GroupStageView from "@/components/GroupStageView";
import {
  BracketData,
  BracketFormat,
  Knockout,
  Participant,
  SPORTS,
  SportId,
  allParticipants,
  bestOfOf,
  bracketChampion,
  buildSlots,
  findParticipant,
  followStatus,
  bracketFormat,
  fillBrackets,
  hasProgress,
  knockoutView,
  knockoutsOf,
  newId,
  normalize,
  participantCount,
  qualifierPlaceholders,
  ranksOf,
  rearrange,
  sportOf,
  swapSlots,
  updateKnockout,
} from "@/lib/bracket";
import {
  deleteLocal,
  getLocal,
  isLocalId,
  saveLocal,
} from "@/lib/localBrackets";
import { SLUG_MAX, slugify } from "@/lib/slug";
import { getLocalFavorite, setLocalFavorite } from "@/lib/localFavorites";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function BracketPage({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<BracketData | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  /** Team this viewer follows — theirs alone, not part of the bracket. */
  const [favorite, setFavorite] = useState<string | null>(null);
  const [followOpen, setFollowOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seedEdit, setSeedEdit] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const local = isLocalId(id);

  useEffect(() => {
    fetch("/api/me")
      .then(readJson)
      .then((d) => {
        const u = d.user as { isAdmin?: boolean } | null;
        setLoggedIn(!!u);
        setIsAdmin(!!u?.isAdmin);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (local) {
      setFavorite(getLocalFavorite(id));
      return;
    }
    let cancelled = false;
    fetch(`/api/brackets/${id}/favorite`)
      .then(readJson)
      .then((d) => {
        if (cancelled) return;
        // Signed-out viewers fall back to this browser's choice.
        const remote = (d.participantId as string | null) ?? null;
        setFavorite(remote ?? getLocalFavorite(id));
      })
      .catch(() => setFavorite(getLocalFavorite(id)));
    return () => {
      cancelled = true;
    };
  }, [id, local]);

  useEffect(() => {
    if (local) {
      const b = getLocal(id);
      if (!b) setNotFound(true);
      else {
        setData(normalize(b));
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
        setData(normalize(d.bracket));
        setCanEdit(d.canEdit);
        setSlug(d.slug ?? null);
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

  /** Apply a change to one knockout's own slots/results. */
  function changeKnockout(k: Knockout, next: BracketData) {
    if (!data) return;
    onChange(
      updateKnockout(data, k.id, {
        slots: next.slots ?? k.slots,
        results: next.results ?? k.results,
      })
    );
  }

  function arrange(mode: "seeded" | "random") {
    if (!data || !confirmRearrange()) return;
    setSeedEdit(false);
    let next = data;
    for (const k of knockoutsOf(data)) {
      const arranged = rearrange(knockoutView(data, k), mode);
      next = updateKnockout(next, k.id, {
        slots: arranged.slots,
        results: arranged.results,
      });
    }
    onChange(next);
    showToast(mode === "seeded" ? "Arranged by seed" : "Random draw complete");
  }

  function startSeedEdit() {
    if (!data) return;
    if (!seedEdit && !confirmRearrange()) return;
    setSeedEdit(!seedEdit);
  }

  function onSwap(k: Knockout, a: number, b: number) {
    if (!data) return;
    const swapped = swapSlots(knockoutView(data, k), a, b);
    onChange(
      updateKnockout(data, k.id, {
        slots: swapped.slots,
        results: swapped.results,
      })
    );
  }

  function doFillBrackets() {
    if (!data) return;
    if (
      hasProgress(data) &&
      !confirm(
        "Refill the brackets from the current group standings? Bracket scores will be cleared (group results and match schedules are kept)."
      )
    )
      return;
    onChange(fillBrackets(data));
    showToast("Brackets filled from group standings");
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

  function shareUrl(): string {
    return slug
      ? `${window.location.origin}/${slug}`
      : window.location.href;
  }

  function chooseFavorite(teamId: string | null) {
    setFavorite(teamId);
    setFollowOpen(false);
    // Always keep a local copy so it survives a signed-out reload.
    setLocalFavorite(id, teamId);
    if (!local && loggedIn) {
      fetch(`/api/brackets/${id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: teamId }),
      }).catch(() => {});
    }
    const team = teamId && data ? findParticipant(data, teamId) : null;
    showToast(team ? `Following ${team.name}` : "Stopped following");
  }

  function share() {
    const url = shareUrl();
    navigator.clipboard
      .writeText(url)
      .then(() => showToast(slug ? "Custom link copied" : "Link copied"))
      .catch(() => showToast(url));
  }

  async function saveSlug(next: string): Promise<string | null> {
    const res = await fetch(`/api/brackets/${id}/slug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: next }),
    });
    const body = await readJson(res);
    if (!res.ok) return String(body.error ?? "Could not save that link.");
    setSlug((body.slug as string | null) ?? null);
    showToast(body.slug ? "Custom link saved" : "Custom link removed");
    return null;
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

  const knockouts = knockoutsOf(data);
  const sectioned = knockouts.length > 1 || !!data.groupStage;
  const soleChampion = sectioned
    ? null
    : bracketChampion(knockoutView(data, knockouts[0]));
  const sport = sportOf(data);
  const bestOf = bestOfOf(data);
  const favoriteTeam = favorite ? findParticipant(data, favorite) : null;
  const favoriteStatus = favorite ? followStatus(data, favorite) : null;

  return (
    <main className="container" style={{ maxWidth: 1400 }}>
      <div className="bracket-toolbar">
        <h1>{data.name}</h1>
        {soleChampion && (
          <span className="champion-banner">🏆 {soleChampion.name} wins</span>
        )}
        <span className="hint">
          {participantCount(data)} teams
          {sport.scoring === "series" && bestOf > 1
            ? ` · ${sport.label}, best of ${bestOf}`
            : sport.label !== SPORTS.other.label
              ? ` · ${sport.label}`
              : ""}
        </span>
        <button
          className={`btn small${favorite ? " following" : ""}`}
          onClick={() => setFollowOpen(true)}
        >
          {favoriteTeam ? `★ ${favoriteTeam.name}` : "☆ Follow a team"}
        </button>
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

      {favoriteTeam && favoriteStatus && (
        <div className={`follow-strip ${favoriteStatus.state}`}>
          <span className="follow-star" aria-hidden>
            ★
          </span>
          <strong>{favoriteTeam.name}</strong>
          <span className="follow-where">{favoriteStatus.label}</span>
          <span style={{ flex: 1 }} />
          <button
            className="btn small ghost"
            onClick={() => chooseFavorite(null)}
          >
            Stop following
          </button>
        </div>
      )}

      {followOpen && (
        <FollowPicker
          teams={allParticipants(data)}
          current={favorite}
          onPick={chooseFavorite}
          onClose={() => setFollowOpen(false)}
        />
      )}

      {canEdit && panelOpen && (
        <CustomizePanel
          data={data}
          slug={slug}
          canSetSlug={isAdmin && !local}
          onSaveSlug={saveSlug}
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
            <strong>Custom placement:</strong> drag a team onto another to swap
            them — or tap one, then tap the other.
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
            Click any match to enter{" "}
            {bestOf > 1 ? `${sport.unit.toLowerCase()} scores` : "scores"}, pick
            a winner, or set a time and location.
          </p>
        )
      )}

      {data.groupStage && (
        <>
          <div className="stage-head">
            <h2>Group stage</h2>
            <span className="hint">
              {knockouts
                .map((k) => `${describeRanks(ranksOf(k, data.groupStage))} → ${k.name}`)
                .join(" · ")}
            </span>
            {canEdit && (
              <>
                <button
                  className={`btn small${moveMode ? " primary" : ""}`}
                  onClick={() => setMoveMode(!moveMode)}
                >
                  {moveMode ? "Done moving" : "Move teams"}
                </button>
                <button className="btn small primary" onClick={doFillBrackets}>
                  Fill brackets from standings
                </button>
              </>
            )}
          </div>
          {moveMode && (
            <div className="seed-edit-banner">
              <span>
                <strong>Moving teams:</strong> drag a team onto another group
                — or tap the team, then tap the group it&apos;s joining.
              </span>
              <button
                className="btn small primary"
                onClick={() => setMoveMode(false)}
              >
                Done
              </button>
            </div>
          )}
          <GroupStageView
            data={data}
            editable={canEdit}
            onChange={onChange}
            moveMode={moveMode}
            onNotice={showToast}
            favorite={favorite}
          />
        </>
      )}

      {knockouts.map((k) => {
        const view = knockoutView(data, k);
        const champ = bracketChampion(view);
        return (
          <div key={k.id}>
            {sectioned && (
              <div className="stage-head">
                <h2>{k.name}</h2>
                {champ ? (
                  <span className="champion-banner">🏆 {champ.name} wins</span>
                ) : (
                  data.groupStage && (
                    <span className="hint">
                      {placeholderHint(ranksOf(k, data.groupStage))}
                    </span>
                  )
                )}
              </div>
            )}
            <BracketView
              data={view}
              editable={canEdit}
              onChange={(next) => changeKnockout(k, next)}
              seedEdit={seedEdit}
              onSwap={(a, b) => onSwap(k, a, b)}
              teamEdit={panelOpen && !seedEdit}
              favorite={favorite}
            />
          </div>
        );
      })}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

/** Explain the A1 / B3 placeholder scheme for the places this bracket takes. */
function placeholderHint(ranks: number[]): string {
  const first = ranks[0] ?? 1;
  const example =
    first === 1
      ? "A1 is the Group A winner"
      : first === 2
        ? "A2 is the Group A runner-up"
        : `A${first} is ${describeRanks([first])} in Group A`;
  return `${example} — names fill in when you use the button above.`;
}

function describeRanks(ranks: number[]): string {
  if (ranks.length === 0) return "No places";
  const sorted = [...ranks].sort((a, b) => a - b);
  const ordinal = (n: number) =>
    n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] ?? ["th", "st", "nd", "rd"][n] ?? "th");
  if (sorted.length === 1) return ordinal(sorted[0]);
  const contiguous = sorted.every((r, i) => i === 0 || r === sorted[i - 1] + 1);
  return contiguous
    ? `${ordinal(sorted[0])}–${ordinal(sorted[sorted.length - 1])}`
    : sorted.map(ordinal).join(", ");
}

function CustomizePanel({
  data,
  slug,
  canSetSlug,
  onSaveSlug,
  seedEdit,
  onArrange,
  onToggleSeedEdit,
  onChange,
  onDelete,
  onDone,
}: {
  data: BracketData;
  slug: string | null;
  canSetSlug: boolean;
  onSaveSlug: (slug: string) => Promise<string | null>;
  seedEdit: boolean;
  onArrange: (mode: "seeded" | "random") => void;
  onToggleSeedEdit: () => void;
  onChange: (next: BracketData) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(data.name);
  const sport = sportOf(data);
  const bestOf = bestOfOf(data);
  const stage = data.groupStage;
  const knockouts = knockoutsOf(data);
  const groupSize = stage
    ? Math.max(...stage.groups.map((g) => g.length))
    : 0;

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === data.name) {
      setName(data.name);
      return;
    }
    onChange({ ...data, name: trimmed.slice(0, 120), updatedAt: Date.now() });
  }

  function setSport(id: SportId) {
    const def = SPORTS[id];
    // Keep a deliberate series length when moving between series sports;
    // otherwise adopt the new sport's normal one (so picking Volleyball
    // gives best-of-3 rather than inheriting a single-game default).
    const keep =
      sport.scoring === "series" && def.bestOfOptions.includes(bestOf);
    onChange({
      ...data,
      sport: id,
      bestOf: keep ? bestOf : def.defaultBestOf,
      updatedAt: Date.now(),
    });
  }

  function patchKnockout(kid: string, patch: Partial<Knockout>) {
    onChange(updateKnockout(data, kid, patch));
  }

  function setRanks(k: Knockout, from: number, to: number) {
    const lo = Math.max(1, Math.min(from, to));
    const hi = Math.min(groupSize || 8, Math.max(from, to));
    const takeRanks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    // Keep placeholders in step so the bracket shape previews correctly.
    const placeholders = qualifierPlaceholders(
      stage?.groups.length ?? 0,
      takeRanks
    );
    patchKnockout(k.id, {
      takeRanks,
      slots:
        placeholders.length >= 2 && !hasProgress(knockoutView(data, k))
          ? buildPreviewSlots(placeholders)
          : k.slots,
    });
  }

  function addBracket() {
    if (!stage) return;
    const used = new Set(knockouts.flatMap((k) => ranksOf(k, stage)));
    let next = 1;
    while (used.has(next) && next <= groupSize) next++;
    const takeRanks = next <= groupSize ? [next] : [groupSize];
    onChange({
      ...data,
      knockouts: [
        ...knockouts,
        {
          id: newId("k_"),
          name: nextBracketName(knockouts.length),
          takeRanks,
          slots: buildPreviewSlots(
            qualifierPlaceholders(stage.groups.length, takeRanks)
          ),
          results: {},
        },
      ],
      updatedAt: Date.now(),
    });
  }

  function removeBracket(kid: string) {
    if (knockouts.length < 2) return;
    onChange({
      ...data,
      knockouts: knockouts.filter((k) => k.id !== kid),
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="card customize-panel">
      <div className="customize-section">
        <h2>Tournament name</h2>
        <input
          className="input"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.target as HTMLInputElement).blur()
          }
          aria-label="Bracket name"
        />
      </div>

      {canSetSlug && (
        <div className="customize-section">
          <h2>Custom link</h2>
          <SlugEditor slug={slug} onSave={onSaveSlug} />
        </div>
      )}

      <div className="customize-section">
        <h2>Sport &amp; scoring</h2>
        <div className="sport-row">
          <select
            className="input"
            value={data.sport ?? "other"}
            aria-label="Sport"
            onChange={(e) => setSport(e.target.value as SportId)}
          >
            {(Object.keys(SPORTS) as SportId[]).map((id) => (
              <option key={id} value={id}>
                {SPORTS[id].label}
              </option>
            ))}
          </select>
          {sport.bestOfOptions.length > 1 && (
            <select
              className="input"
              value={bestOf}
              aria-label="Series length"
              onChange={(e) =>
                onChange({
                  ...data,
                  bestOf: Number(e.target.value),
                  updatedAt: Date.now(),
                })
              }
            >
              {sport.bestOfOptions.map((n) => (
                <option key={n} value={n}>
                  {n === 1
                    ? "Single game"
                    : `Best of ${n} ${sport.unit.toLowerCase()}s`}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="hint" style={{ margin: "8px 0 0" }}>
          {bestOf > 1
            ? `Each match is won by taking ${Math.floor(bestOf / 2) + 1} ${sport.unit.toLowerCase()}s. Enter every ${sport.unit.toLowerCase()} score and the bracket advances the winner.`
            : "Each match is decided by a single score."}
        </p>
      </div>

      <div className="customize-section">
        <h2>Format</h2>
        <p className="hint" style={{ margin: "0 0 10px" }}>
          Switching keeps recorded results — losers-bracket games are simply
          hidden in single elimination.
        </p>
        <div className="placement-row">
          {(
            [
              ["single", "Single elimination"],
              ["double", "Double elimination"],
            ] as [BracketFormat, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={`chip${bracketFormat(data) === value ? " active" : ""}`}
              onClick={() =>
                onChange({ ...data, format: value, updatedAt: Date.now() })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="customize-section">
        <h2>Placement</h2>
        <p className="hint" style={{ margin: "0 0 10px" }}>
          How teams are arranged. Re-arranging clears scores but keeps match
          locations and times.
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

      {stage && (
        <div className="customize-section span-all">
          <h2>Brackets</h2>
          <p className="hint" style={{ margin: "0 0 10px" }}>
            Split the groups into separate brackets — for example places 1–2
            into Gold and places 3–4 into Silver. Use “Fill brackets from
            standings” once pool play is done.
          </p>
          <div className="splits">
            {knockouts.map((k) => {
              const ranks = ranksOf(k, stage);
              const lo = ranks[0] ?? 1;
              const hi = ranks[ranks.length - 1] ?? 1;
              return (
                <div key={k.id} className="split-row">
                  <input
                    className="input"
                    value={k.name}
                    maxLength={40}
                    aria-label="Bracket name"
                    onChange={(e) =>
                      patchKnockout(k.id, {
                        name: e.target.value.slice(0, 40),
                      })
                    }
                  />
                  <span className="split-label">takes places</span>
                  <input
                    className="input split-num"
                    type="number"
                    min={1}
                    max={groupSize}
                    value={lo}
                    aria-label="First place taken"
                    onChange={(e) => setRanks(k, Number(e.target.value), hi)}
                  />
                  <span className="split-label">to</span>
                  <input
                    className="input split-num"
                    type="number"
                    min={1}
                    max={groupSize}
                    value={hi}
                    aria-label="Last place taken"
                    onChange={(e) => setRanks(k, lo, Number(e.target.value))}
                  />
                  <span className="split-count">
                    {ranks.length * stage.groups.length} teams
                  </span>
                  <button
                    className="btn small ghost danger"
                    disabled={knockouts.length < 2}
                    onClick={() => removeBracket(k.id)}
                    aria-label={`Remove ${k.name}`}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
          <button
            className="btn small"
            style={{ marginTop: 10 }}
            onClick={addBracket}
          >
            Add a bracket
          </button>
        </div>
      )}

      <div className="customize-footer">
        <button className="btn small ghost danger" onClick={onDelete}>
          Delete tournament
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn small primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function nextBracketName(count: number): string {
  return ["Gold", "Silver", "Bronze", "Consolation"][count] ?? `Bracket ${count + 1}`;
}

/** Seed placeholder qualifiers into a preview bracket shape. */
function buildPreviewSlots(
  placeholders: ReturnType<typeof qualifierPlaceholders>
) {
  return buildSlots(placeholders, "seeded");
}

/** Admin-only editor for a bracket's vanity URL. */
function SlugEditor({
  slug,
  onSave,
}: {
  slug: string | null;
  onSave: (slug: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(slug ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const host = origin.replace(/^https?:\/\//, "");

  async function submit(next: string) {
    setBusy(true);
    setError("");
    const err = await onSave(next);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <>
      <div className="slug-row">
        <span className="slug-prefix">{host}/</span>
        <input
          className="input"
          value={value}
          maxLength={SLUG_MAX}
          placeholder="blalock2026"
          aria-label="Custom link"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setValue((v) => slugify(v))}
        />
        <button
          className="btn small primary"
          disabled={busy || slugify(value) === (slug ?? "")}
          onClick={() => submit(slugify(value))}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {slug && (
          <button
            className="btn small ghost danger"
            disabled={busy}
            onClick={() => {
              setValue("");
              submit("");
            }}
          >
            Remove
          </button>
        )}
      </div>
      {error ? (
        <p className="error-msg" style={{ margin: "8px 0 0" }}>
          {error}
        </p>
      ) : (
        <p className="hint" style={{ margin: "8px 0 0" }}>
          {slug
            ? `Live at ${host}/${slug} — the original link keeps working too.`
            : "Lowercase letters, numbers and hyphens. The /b/… link keeps working either way."}
        </p>
      )}
    </>
  );
}

/** Pick one team to follow through the tournament. */
function FollowPicker({
  teams,
  current,
  onPick,
  onClose,
}: {
  teams: Participant[];
  current: string | null;
  onPick: (teamId: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  // People scan this list for a name, so order it that way rather than by
  // draw position.
  const shown = teams
    .filter((t) => !needle || t.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Follow a team</h2>
        <p className="sub">
          They&apos;ll be highlighted everywhere they appear, so you can always
          spot them. Only you see this.
        </p>
        {teams.length > 8 && (
          <input
            className="input"
            placeholder="Search teams…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search teams"
          />
        )}
        <div className="follow-list">
          {shown.map((t) => (
            <button
              key={t.id}
              className={`follow-option${current === t.id ? " active" : ""}`}
              onClick={() => onPick(current === t.id ? null : t.id)}
            >
              <span className="follow-mark" aria-hidden>
                {current === t.id ? "★" : "☆"}
              </span>
              <span className="follow-name">{t.name}</span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="hint" style={{ padding: "8px 2px" }}>
              No teams match “{query}”.
            </p>
          )}
        </div>
        <div className="modal-actions">
          {current && (
            <button className="btn ghost danger" onClick={() => onPick(null)}>
              Stop following
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
