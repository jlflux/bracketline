"use client";

import { useState } from "react";
import {
  BracketData,
  GroupStage,
  Match,
  MatchResult,
  Participant,
  groupLetter,
  groupMatchKey,
  groupQualifiers,
  groupStandings,
  roundRobinRounds,
} from "@/lib/bracket";
import { MatchEditor } from "./BracketView";

type Props = {
  data: BracketData;
  editable: boolean;
  onChange?: (next: BracketData) => void;
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
    winner: f.result.winner
      ? f.result.winner === 1
        ? f.p1
        : f.p2
      : null,
  };
}

export default function GroupStageView({ data, editable, onChange }: Props) {
  const stage = data.groupStage!;
  const [editing, setEditing] = useState<Fixture | null>(null);
  /** Group index currently in manual-override selection mode, with the
   *  ordered picks so far. */
  const [overriding, setOverriding] = useState<number | null>(null);
  const [picks, setPicks] = useState<string[]>([]);

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
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < stage.advance
          ? [...prev, id]
          : prev
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

  return (
    <div className="groups-grid">
      {stage.groups.map((group, gi) => {
        const standings = groupStandings(stage, gi);
        const qualifiers = groupQualifiers(stage, gi);
        const qualifierIds = new Set(qualifiers.map((p) => p.id));
        const hasOverride = !!stage.overrides[String(gi)]?.length;
        const isOverriding = overriding === gi;
        const fixtures = fixturesFor(stage, gi);
        const played = fixtures.filter((f) => f.result.winner).length;

        return (
          <div key={gi} className="card group-card">
            <div className="group-head">
              <h2>Group {groupLetter(gi)}</h2>
              <span className="hint">
                {played}/{fixtures.length} played
              </span>
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
                      Save picks
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn small ghost"
                    onClick={() => startOverride(gi)}
                    title="Pick who advances manually (tiebreakers, forfeits…)"
                  >
                    {hasOverride ? "Edit advancers ✱" : "Advance manually"}
                  </button>
                ))}
            </div>

            {isOverriding && (
              <p className="hint" style={{ margin: "0 0 8px" }}>
                Tap teams in finishing order — first tap is the group winner.
                {` ${picks.length}/${stage.advance} picked.`}
              </p>
            )}

            <table className="standings">
              <thead>
                <tr>
                  <th></th>
                  <th className="team-col">Team</th>
                  <th>W</th>
                  <th>L</th>
                  <th>+/−</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, rank) => {
                  const pickIndex = picks.indexOf(row.p.id);
                  const advancing = isOverriding
                    ? pickIndex >= 0
                    : qualifierIds.has(row.p.id);
                  return (
                    <tr
                      key={row.p.id}
                      className={`${advancing ? "advancing" : ""}${
                        isOverriding ? " pickable" : ""
                      }`}
                      onClick={
                        isOverriding ? () => togglePick(row.p.id) : undefined
                      }
                    >
                      <td className="rank">
                        {isOverriding
                          ? pickIndex >= 0
                            ? pickIndex + 1
                            : "·"
                          : rank + 1}
                      </td>
                      <td className="team-col">
                        {row.p.seed && (
                          <span className="seed-tag">{row.p.seed}</span>
                        )}{" "}
                        {row.p.name}
                      </td>
                      <td>{row.w}</td>
                      <td>{row.l}</td>
                      <td>
                        {row.pf - row.pa > 0 ? "+" : ""}
                        {row.pf - row.pa}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasOverride && !isOverriding && (
              <p className="hint" style={{ margin: "6px 0 0" }}>
                ✱ Advancement set manually.
              </p>
            )}

            <div className="fixtures">
              {fixtures.map((f) => (
                <button
                  key={f.key}
                  className={`fixture${f.result.winner ? " done" : ""}`}
                  disabled={!editable}
                  onClick={() => setEditing(f)}
                >
                  <span
                    className={`fx-team${f.result.winner === 1 ? " won" : ""}`}
                  >
                    {f.p1.name}
                  </span>
                  <span className="fx-score">
                    {f.result.winner
                      ? f.result.s1 !== null && f.result.s2 !== null
                        ? `${f.result.s1}–${f.result.s2}`
                        : "✓"
                      : "vs"}
                  </span>
                  <span
                    className={`fx-team right${
                      f.result.winner === 2 ? " won" : ""
                    }`}
                  >
                    {f.p2.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {editing && (
        <MatchEditor
          match={fixtureAsMatch(editing)}
          onSave={(res) => saveFixture(editing, res)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
