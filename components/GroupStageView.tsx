"use client";

import { useState } from "react";
import {
  BracketData,
  GroupStage,
  Match,
  MatchResult,
  Participant,
  bracketFilled,
  bracketForRank,
  groupLetter,
  groupMatchKey,
  groupRanking,
  groupStandings,
  formatSchedule,
  hasSchedule,
  isSeries,
  knockoutsOf,
  moveTeamToGroup,
  playedAgainstGroup,
  roundRobinRounds,
  sportOf,
} from "@/lib/bracket";
import { MatchEditor } from "./BracketView";

type Props = {
  data: BracketData;
  editable: boolean;
  onChange?: (next: BracketData) => void;
  /** When on, teams can be dragged (or tapped) between groups. */
  moveMode?: boolean;
  onNotice?: (message: string) => void;
  /** Id of the team this viewer follows, highlighted throughout. */
  favorite?: string | null;
};

type Fixture = {
  gi: number;
  i: number;
  j: number;
  round: number;
  key: string;
  p1: Participant;
  p2: Participant;
  result: MatchResult;
};

const EMPTY: MatchResult = { s1: null, s2: null, winner: null };

function fixturesFor(stage: GroupStage, gi: number): Fixture[] {
  const group = stage.groups[gi];
  const out: Fixture[] = [];
  roundRobinRounds(group.length).forEach((pairs, round) => {
    for (const [i, j] of pairs) {
      const key = groupMatchKey(gi, i, j);
      out.push({
        gi,
        i,
        j,
        round,
        key,
        p1: group[i],
        p2: group[j],
        result: stage.results[key] ?? EMPTY,
      });
    }
  });
  return out;
}

/** Adapter so the shared MatchEditor can edit a group fixture. */
function fixtureAsMatch(f: Fixture): Match {
  return {
    section: "w",
    round: f.round,
    index: 0,
    key: f.key,
    num: `Group ${groupLetter(f.gi)}`,
    p1: f.p1,
    p2: f.p2,
    p1Alive: true,
    p2Alive: true,
    result: f.result,
    isBye: false,
    winner: f.result.winner ? (f.result.winner === 1 ? f.p1 : f.p2) : null,
  };
}

export default function GroupStageView({
  data,
  editable,
  onChange,
  moveMode = false,
  onNotice,
  favorite = null,
}: Props) {
  const stage = data.groupStage!;
  const series = isSeries(data);
  const knockouts = knockoutsOf(data);
  // Only name a destination once the brackets actually hold teams — before
  // that the split is just a plan, not a result.
  const showDest = knockouts.length > 1 && knockouts.some(bracketFilled);
  const topBracketId = knockouts[0]?.id;
  const sport = sportOf(data);
  const [editing, setEditing] = useState<Fixture | null>(null);
  /** Group index currently in manual-order mode, with the picks so far. */
  const [overriding, setOverriding] = useState<number | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  /** Team picked up for moving (drag or first tap). */
  const [heldTeam, setHeldTeam] = useState<string | null>(null);

  function patchStage(patch: Partial<GroupStage>) {
    onChange?.({
      ...data,
      groupStage: { ...stage, ...patch },
      updatedAt: Date.now(),
    });
  }

  function saveFixture(f: Fixture, result: MatchResult) {
    patchStage({
      results: {
        ...stage.results,
        [f.key]: { ...result, p1Id: f.p1.id, p2Id: f.p2.id },
      },
    });
    setEditing(null);
  }

  function startOverride(gi: number) {
    setOverriding(gi);
    setPicks(stage.overrides[String(gi)] ?? []);
  }

  function togglePick(id: string) {
    setPicks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function saveOverride() {
    if (overriding === null) return;
    patchStage({
      overrides: { ...stage.overrides, [String(overriding)]: picks },
    });
    setOverriding(null);
  }

  function clearOverride(gi: number) {
    const overrides = { ...stage.overrides };
    delete overrides[String(gi)];
    patchStage({ overrides });
    setOverriding(null);
  }

  function moveTeam(teamId: string, toGroup: number, toIndex?: number) {
    setHeldTeam(null);
    const from = stage.groups.findIndex((g) =>
      g.some((p) => p.id === teamId)
    );
    if (from === toGroup) return;
    const lost = playedAgainstGroup(stage, teamId);
    if (
      lost > 0 &&
      !confirm(
        `Moving this team drops the ${lost} match${lost === 1 ? "" : "es"} it has already played in its current group. Continue?`
      )
    )
      return;
    const next = moveTeamToGroup(stage, teamId, toGroup, toIndex);
    if (!next) {
      onNotice?.(
        "Can't move that team — groups need at least 2 teams and hold at most 8."
      );
      return;
    }
    onChange?.({ ...data, groupStage: next, updatedAt: Date.now() });
    onNotice?.(`Moved to Group ${groupLetter(toGroup)}`);
  }

  return (
    <div className="groups-grid">
      {stage.groups.map((group, gi) => {
        const standings = groupStandings(stage, gi);
        const ranking = groupRanking(stage, gi);
        const rankOf = new Map(ranking.map((p, i) => [p.id, i + 1]));
        const hasOverride = !!stage.overrides[String(gi)]?.length;
        const isOverriding = overriding === gi;
        const fixtures = fixturesFor(stage, gi);
        const played = fixtures.filter((f) => f.result.winner).length;

        // Show rows in finishing order, which may be pinned manually.
        const rows = [...standings].sort(
          (a, b) => (rankOf.get(a.p.id) ?? 99) - (rankOf.get(b.p.id) ?? 99)
        );

        return (
          <div
            key={gi}
            className={`card group-card${moveMode ? " move-target" : ""}${
              moveMode && heldTeam && !group.some((p) => p.id === heldTeam)
                ? " droppable"
                : ""
            }`}
            onDragOver={moveMode ? (e) => e.preventDefault() : undefined}
            onDrop={
              moveMode
                ? (e) => {
                    e.preventDefault();
                    if (heldTeam) moveTeam(heldTeam, gi);
                  }
                : undefined
            }
            onClick={
              moveMode && heldTeam && !group.some((p) => p.id === heldTeam)
                ? () => moveTeam(heldTeam, gi)
                : undefined
            }
          >
            <div className="group-head">
              <h2>Group {groupLetter(gi)}</h2>
              {moveMode && heldTeam && !group.some((p) => p.id === heldTeam) ? (
                <button
                  className="btn small primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveTeam(heldTeam, gi);
                  }}
                >
                  Move here
                </button>
              ) : (
                <span className="hint">
                  {played}/{fixtures.length} played
                </span>
              )}
              {editable &&
                (isOverriding ? (
                  <span className="group-override-actions">
                    <button
                      className="btn small ghost"
                      onClick={() => clearOverride(gi)}
                    >
                      Use standings
                    </button>
                    <button
                      className="btn small primary"
                      disabled={picks.length === 0}
                      onClick={saveOverride}
                    >
                      Save order
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn small ghost"
                    onClick={() => startOverride(gi)}
                    title="Set the finishing order by hand (tiebreakers, forfeits…)"
                  >
                    {hasOverride ? "Edit order ✱" : "Set order"}
                  </button>
                ))}
            </div>

            {isOverriding && (
              <p className="hint" style={{ margin: "0 0 8px" }}>
                Tap teams in finishing order — first tap is the group winner.
                Any you skip stay in standings order behind them.
              </p>
            )}

            <div className="standings-wrap">
              <table className="standings">
                <thead>
                  <tr>
                    <th className="rank-col"></th>
                    <th className="team-col">Team</th>
                    <th title="Matches won">W</th>
                    <th title="Matches lost">L</th>
                    {series && (
                      <>
                        <th title={`${sport.unit}s won`}>SW</th>
                        <th title={`${sport.unit}s lost`}>SL</th>
                      </>
                    )}
                    <th title={`${sport.pointsLabel} for`}>PF</th>
                    <th title={`${sport.pointsLabel} against`}>PA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const rank = rankOf.get(row.p.id) ?? 0;
                    const dest = bracketForRank(data, rank);
                    const pickIndex = picks.indexOf(row.p.id);
                    // Highlight the places going to the top bracket; other
                    // brackets are identified by their badge instead.
                    const advancing = isOverriding
                      ? pickIndex >= 0
                      : dest?.id === topBracketId;
                    const held = heldTeam === row.p.id;
                    return (
                      <tr
                        key={row.p.id}
                        className={`${advancing ? "advancing" : ""}${
                          isOverriding ? " pickable" : ""
                        }${moveMode ? " movable" : ""}${held ? " held" : ""}${
                          row.p.id === favorite ? " followed" : ""
                        }`}
                        draggable={moveMode || undefined}
                        onDragStart={
                          moveMode
                            ? (e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setHeldTeam(row.p.id);
                              }
                            : undefined
                        }
                        onDragEnd={moveMode ? () => setHeldTeam(null) : undefined}
                        onClick={
                          isOverriding
                            ? () => togglePick(row.p.id)
                            : moveMode
                              ? (e) => {
                                  e.stopPropagation();
                                  // Holding a team from another group? This
                                  // row is where it lands.
                                  const holdingOther =
                                    heldTeam &&
                                    !group.some((p) => p.id === heldTeam);
                                  if (holdingOther)
                                    moveTeam(heldTeam!, gi, row.index);
                                  else setHeldTeam(held ? null : row.p.id);
                                }
                              : undefined
                        }
                      >
                        <td className="rank">
                          {isOverriding
                            ? pickIndex >= 0
                              ? pickIndex + 1
                              : "·"
                            : moveMode
                              ? "⋮⋮"
                              : rank}
                        </td>
                        <td className="team-col">
                          <span className="team-name">
                            {row.p.id === favorite && (
                              <span className="follow-star" aria-label="Following">
                                ★
                              </span>
                            )}
                            {row.p.name}
                          </span>
                          {!isOverriding && !moveMode && dest && showDest && (
                            <span className="dest-badge">{dest.name}</span>
                          )}
                        </td>
                        <td>{row.w}</td>
                        <td>{row.l}</td>
                        {series && (
                          <>
                            <td>{row.setsW}</td>
                            <td>{row.setsL}</td>
                          </>
                        )}
                        <td>{row.pf}</td>
                        <td>{row.pa}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasOverride && !isOverriding && (
              <p className="hint" style={{ margin: "6px 0 0" }}>
                ✱ Finishing order set by hand.
              </p>
            )}

            <div className="fixtures">
              {fixtures.map((f) => (
                <button
                  key={f.key}
                  className={`fixture${f.result.winner ? " done" : ""}${
                    f.p1.id === favorite || f.p2.id === favorite
                      ? " followed"
                      : ""
                  }`}
                  disabled={moveMode}
                  onClick={() => setEditing(f)}
                >
                  <span className="fixture-main">
                  <span
                    className={`fx-team${f.result.winner === 1 ? " won" : ""}${
                      f.p1.id === favorite ? " fav" : ""
                    }`}
                  >
                    {f.p1.name}
                  </span>
                  <span className="fx-mid">
                    <span className="fx-score">
                      {f.result.winner
                        ? f.result.s1 !== null && f.result.s2 !== null
                          ? `${f.result.s1}–${f.result.s2}`
                          : "✓"
                        : "vs"}
                    </span>
                    {f.result.games && (
                      <span className="fx-sets">
                        {f.result.games
                          .filter((g) => g.a !== null && g.b !== null)
                          .map((g) => `${g.a}-${g.b}`)
                          .join(", ")}
                      </span>
                    )}
                  </span>
                  <span
                    className={`fx-team right${
                      f.result.winner === 2 ? " won" : ""
                    }${f.p2.id === favorite ? " fav" : ""}`}
                  >
                    {f.p2.name}
                  </span>
                  </span>
                  {hasSchedule(f.result) && (
                    <span className="fixture-when">
                      {formatSchedule(f.result)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {editing && (
        <MatchEditor
          match={fixtureAsMatch(editing)}
          data={data}
          readOnly={!editable}
          onSave={(res) => saveFixture(editing, res)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
