"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type CombatantType = "PC" | "NPC" | "Monster";

type Combatant = {
  id: string;
  name: string;
  kind: CombatantType;
  initiative: number;
  ac?: number;
  hp?: number;
  maxHp?: number;
  conditions: string[];
  notes?: string;
};

type EncounterState = {
  round: number;
  turnIndex: number;
  combatants: Combatant[];
  lastUpdatedAt: string;
};

const STORAGE_KEY = "stonecross.combat.v1";
const AUTH_SESSION_KEY = "stonecross.session.v1";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeInt(v: string, fallback: number) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function loadEncounter(): EncounterState {
  if (typeof window === "undefined") {
    return { round: 1, turnIndex: 0, combatants: [], lastUpdatedAt: "" };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no data");
    const parsed = JSON.parse(raw) as EncounterState;
    if (!parsed || typeof parsed !== "object") throw new Error("bad data");
    if (!Array.isArray(parsed.combatants)) throw new Error("bad combatants");

    return {
      round: Number.isFinite(parsed.round) ? parsed.round : 1,
      turnIndex: Number.isFinite(parsed.turnIndex) ? parsed.turnIndex : 0,
      combatants: parsed.combatants.map((c) => ({
        id: typeof c.id === "string" ? c.id : uid(),
        name: typeof c.name === "string" ? c.name : "Unnamed",
        kind: c.kind === "PC" || c.kind === "NPC" || c.kind === "Monster" ? c.kind : "NPC",
        initiative: Number.isFinite(c.initiative) ? c.initiative : 0,
        ac: Number.isFinite(c.ac) ? c.ac : undefined,
        hp: Number.isFinite(c.hp) ? c.hp : undefined,
        maxHp: Number.isFinite(c.maxHp) ? c.maxHp : undefined,
        conditions: Array.isArray(c.conditions) ? c.conditions.filter((s) => typeof s === "string") : [],
        notes: typeof c.notes === "string" ? c.notes : "",
      })),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : "",
    };
  } catch {
    return { round: 1, turnIndex: 0, combatants: [], lastUpdatedAt: "" };
  }
}

function saveEncounter(state: EncounterState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, lastUpdatedAt: new Date().toISOString() })
  );
}

function sortByInitiativeDesc(list: Combatant[]) {
  return [...list].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.name.localeCompare(b.name);
  });
}

function getRoleFromLocalStorage(): "dm" | "player" {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return "player";
    const parsed = JSON.parse(raw);
    return parsed?.username === "jbeldiman" ? "dm" : "player";
  } catch {
    return "player";
  }
}

export default function CombatPage() {
  const [isClient, setIsClient] = useState(false);
  const [role, setRole] = useState<"dm" | "player">("player");
  const isDm = role === "dm";

  const [state, setState] = useState<EncounterState>(() => ({
    round: 1,
    turnIndex: 0,
    combatants: [],
    lastUpdatedAt: "",
  }));

  const hasHydrated = useRef(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<CombatantType>("Monster");
  const [initiative, setInitiative] = useState("");
  const [ac, setAc] = useState("");
  const [hp, setHp] = useState("");
  const [maxHp, setMaxHp] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
    setRole(getRoleFromLocalStorage());

    const loaded = loadEncounter();
    setState({ ...loaded, combatants: sortByInitiativeDesc(loaded.combatants) });
  }, []);

  useEffect(() => {
    if (!isClient) return;
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }
    if (!isDm) return;
    saveEncounter(state);
  }, [state, isDm, isClient]);

  const ordered = useMemo(() => sortByInitiativeDesc(state.combatants), [state.combatants]);
  const active = ordered.length ? ordered[clamp(state.turnIndex, 0, Math.max(ordered.length - 1, 0))] : null;

  function setOrdered(next: Combatant[], preserveActiveId?: string) {
    if (!isDm) return;

    const sorted = sortByInitiativeDesc(next);
    let nextTurnIndex = state.turnIndex;

    if (sorted.length === 0) {
      nextTurnIndex = 0;
    } else if (preserveActiveId) {
      const idx = sorted.findIndex((c) => c.id === preserveActiveId);
      nextTurnIndex = idx >= 0 ? idx : 0;
    } else {
      nextTurnIndex = clamp(nextTurnIndex, 0, sorted.length - 1);
    }

    setState((s) => ({ ...s, combatants: sorted, turnIndex: nextTurnIndex }));
  }

  function resetEncounter() {
    if (!isDm) return;
    setState({ round: 1, turnIndex: 0, combatants: [], lastUpdatedAt: "" });
    setName("");
    setKind("Monster");
    setInitiative("");
    setAc("");
    setHp("");
    setMaxHp("");
    setConditions("");
    setNotes("");
  }

  function addCombatant() {
    if (!isDm) return;

    const n = name.trim();
    if (!n) return;

    const init = safeInt(initiative.trim(), 0);
    const acN = ac.trim() ? safeInt(ac.trim(), 0) : undefined;
    const hpN = hp.trim() ? safeInt(hp.trim(), 0) : undefined;
    const maxN = maxHp.trim() ? safeInt(maxHp.trim(), 0) : undefined;
    const conds = conditions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const newC: Combatant = {
      id: uid(),
      name: n,
      kind,
      initiative: init,
      ac: acN,
      hp: hpN,
      maxHp: maxN,
      conditions: conds,
      notes: notes.trim(),
    };

    const preserveId = active?.id;
    setOrdered([...state.combatants, newC], preserveId);

    setName("");
    setInitiative("");
    setAc("");
    setHp("");
    setMaxHp("");
    setConditions("");
    setNotes("");

    requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  function removeCombatant(id: string) {
    if (!isDm) return;
    const preserveId = active?.id === id ? undefined : active?.id;
    setOrdered(state.combatants.filter((c) => c.id !== id), preserveId);
  }

  function updateCombatant(id: string, patch: Partial<Combatant>) {
    if (!isDm) return;
    const preserveId = active?.id;
    setOrdered(
      state.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      preserveId
    );
  }

  function nextTurn() {
    if (!isDm) return;
    if (ordered.length === 0) return;
    setState((s) => {
      const nextIndex = s.turnIndex + 1;
      if (nextIndex >= ordered.length) {
        return { ...s, round: s.round + 1, turnIndex: 0 };
      }
      return { ...s, turnIndex: nextIndex };
    });
  }

  function prevTurn() {
    if (!isDm) return;
    if (ordered.length === 0) return;
    setState((s) => {
      const prevIndex = s.turnIndex - 1;
      if (prevIndex < 0) {
        return {
          ...s,
          round: Math.max(1, s.round - 1),
          turnIndex: Math.max(0, ordered.length - 1),
        };
      }
      return { ...s, turnIndex: prevIndex };
    });
  }

  function startNewRound() {
    if (!isDm) return;
    if (ordered.length === 0) return;
    setState((s) => ({ ...s, round: s.round + 1, turnIndex: 0 }));
  }

  function focusTurn(id: string) {
    if (!isDm) return;
    const idx = ordered.findIndex((c) => c.id === id);
    if (idx < 0) return;
    setState((s) => ({ ...s, turnIndex: idx }));
  }

  if (!isClient) {
    return (
      <main className="sc-page">
        <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/character.jpg')" }} />
        <div className="sc-overlay" />
        <div className="sc-content" style={{ padding: "2rem" }}>
          <header
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div>
              <h1 style={{ fontSize: "2rem", lineHeight: 1.1 }}>Combat</h1>
              <p style={{ opacity: 0.85, marginTop: "0.35rem" }}>
                Quick encounter tracker (local-only for now). Round <strong>1</strong>
              </p>
            </div>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/character.jpg')" }} />
      <div className="sc-overlay" />

      <div className="sc-content" style={{ padding: "2rem" }}>
        <header
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "2rem", lineHeight: 1.1 }}>Combat</h1>
            <p style={{ opacity: 0.85, marginTop: "0.35rem" }}>
              Quick encounter tracker (local-only for now). Round <strong>{state.round}</strong>
              {active ? (
                <>
                  {" "}
                  • Current: <strong>{active.name}</strong>
                </>
              ) : null}
              {!isDm ? (
                <>
                  {" "}
                  • <strong>View only</strong>
                </>
              ) : null}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={prevTurn} style={ghostBtn} disabled={!isDm || ordered.length === 0}>
              Prev
            </button>
            <button onClick={nextTurn} style={btn} disabled={!isDm || ordered.length === 0}>
              Next Turn
            </button>
            <button onClick={startNewRound} style={ghostBtn} disabled={!isDm || ordered.length === 0}>
              New Round
            </button>
            <button onClick={resetEncounter} style={{ ...dangerBtn, marginLeft: "0.25rem" }} disabled={!isDm}>
              Reset
            </button>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: isDm ? "1.1fr 1fr" : "1fr",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          {isDm ? (
            <div style={card}>
              <h2 style={{ marginBottom: "0.5rem" }}>Add Combatant</h2>
              <p style={{ opacity: 0.8, fontSize: "0.95rem", marginBottom: "0.85rem" }}>
                Enter initiative (or 0), optional AC/HP, and any conditions.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.9fr", gap: "0.75rem" }}>
                <label style={{ display: "block" }}>
                  <div style={label}>Name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Frost Warg"
                    style={input}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCombatant();
                    }}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <div style={label}>Type</div>
                  <select value={kind} onChange={(e) => setKind(e.target.value as CombatantType)} style={select}>
                    <option value="PC">PC</option>
                    <option value="NPC">NPC</option>
                    <option value="Monster">Monster</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginTop: "0.75rem" }}>
                <label style={{ display: "block" }}>
                  <div style={label}>Init</div>
                  <input value={initiative} onChange={(e) => setInitiative(e.target.value)} inputMode="numeric" style={input} placeholder="0" />
                </label>

                <label style={{ display: "block" }}>
                  <div style={label}>AC</div>
                  <input value={ac} onChange={(e) => setAc(e.target.value)} inputMode="numeric" style={input} placeholder="—" />
                </label>

                <label style={{ display: "block" }}>
                  <div style={label}>HP</div>
                  <input value={hp} onChange={(e) => setHp(e.target.value)} inputMode="numeric" style={input} placeholder="—" />
                </label>

                <label style={{ display: "block" }}>
                  <div style={label}>Max</div>
                  <input value={maxHp} onChange={(e) => setMaxHp(e.target.value)} inputMode="numeric" style={input} placeholder="—" />
                </label>
              </div>

              <label style={{ display: "block", marginTop: "0.75rem" }}>
                <div style={label}>Conditions (comma-separated)</div>
                <input value={conditions} onChange={(e) => setConditions(e.target.value)} style={input} placeholder="e.g., prone, grappled" />
              </label>

              <label style={{ display: "block", marginTop: "0.75rem" }}>
                <div style={label}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ ...input, minHeight: 78, resize: "vertical" }}
                  placeholder="Legendary resist used, concentrating on..."
                />
              </label>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.9rem" }}>
                <button onClick={addCombatant} style={btn}>
                  Add
                </button>
                <button
                  onClick={() => {
                    setName("");
                    setInitiative("");
                    setAc("");
                    setHp("");
                    setMaxHp("");
                    setConditions("");
                    setNotes("");
                  }}
                  style={ghostBtn}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div style={card}>
            <h2 style={{ marginBottom: "0.5rem" }}>Current Turn</h2>

            {active ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>{active.name}</div>
                    <div style={{ opacity: 0.85, marginTop: "0.15rem" }}>
                      <strong>{active.kind}</strong> • Init <strong>{active.initiative}</strong>
                      {typeof active.ac === "number" ? (
                        <>
                          {" "}
                          • AC <strong>{active.ac}</strong>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <span style={pill}>
                    Round {state.round} • Turn {ordered.length ? state.turnIndex + 1 : 0}/{ordered.length}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.85rem" }}>
                  <div style={{ ...subCard, padding: "0.75rem" }}>
                    <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>HP</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                      <HpPill c={active} />
                      {isDm ? <HpAdjust c={active} onChange={(nextHp) => updateCombatant(active.id, { hp: nextHp })} /> : null}
                      <button
                        style={ghostBtnSmall}
                        onClick={() => updateCombatant(active.id, { hp: active.maxHp ?? active.hp })}
                        disabled={!isDm || typeof active.maxHp !== "number"}
                        title={typeof active.maxHp !== "number" ? "Set Max HP to use" : "Set HP to Max"}
                      >
                        Full
                      </button>
                    </div>
                  </div>

                  <div style={{ ...subCard, padding: "0.75rem" }}>
                    <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>Conditions</div>
                    <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {active.conditions.length ? (
                        active.conditions.map((cnd) => (
                          <button
                            key={cnd}
                            onClick={() =>
                              updateCombatant(active.id, {
                                conditions: active.conditions.filter((x) => x !== cnd),
                              })
                            }
                            style={condPill}
                            disabled={!isDm}
                            title={isDm ? "Click to remove" : undefined}
                          >
                            {cnd}
                          </button>
                        ))
                      ) : (
                        <span style={{ opacity: 0.7 }}>None</span>
                      )}
                    </div>

                    {isDm ? (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                        <input
                          placeholder="add condition"
                          style={{ ...input, padding: "0.55rem 0.65rem" }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            const v = (e.currentTarget.value || "").trim();
                            if (!v) return;
                            e.currentTarget.value = "";
                            updateCombatant(active.id, {
                              conditions: Array.from(new Set([...(active.conditions || []), v])),
                            });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: "0.85rem" }}>
                  <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>Notes</div>
                  <textarea
                    value={active.notes || ""}
                    onChange={(e) => updateCombatant(active.id, { notes: e.target.value })}
                    readOnly={!isDm}
                    style={{ ...input, minHeight: 92, resize: "vertical", marginTop: "0.35rem" }}
                    placeholder="What matters right now…"
                  />
                </div>
              </div>
            ) : (
              <p style={{ opacity: 0.85 }}>No active encounter yet.</p>
            )}
          </div>
        </section>

        <section ref={listRef} style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem" }}>Initiative Order</h2>
            <span style={{ opacity: 0.75, fontSize: "0.9rem" }}>
              Saved locally • {state.combatants.length} combatant{state.combatants.length === 1 ? "" : "s"}
            </span>
          </div>

          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.6rem" }}>
            {ordered.length ? (
              ordered.map((c, idx) => {
                const isActive = active?.id === c.id;
                return (
                  <div key={c.id} style={{ ...row, borderColor: isActive ? "#d4af37" : "#222" }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                        <span
                          style={{
                            ...pill,
                            background: isActive ? "rgba(212,175,55,0.14)" : "rgba(255,255,255,0.06)",
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>{c.name}</span>
                        <span style={{ opacity: 0.85 }}>{c.kind}</span>
                      </div>
                      <div style={{ opacity: 0.8, marginTop: "0.2rem" }}>
                        Init <strong>{c.initiative}</strong>
                        {typeof c.ac === "number" ? (
                          <>
                            {" "}
                            • AC <strong>{c.ac}</strong>
                          </>
                        ) : null}
                        {typeof c.hp === "number" ? (
                          <>
                            {" "}
                            • HP <strong>{c.hp}</strong>
                            {typeof c.maxHp === "number" ? `/${c.maxHp}` : ""}
                          </>
                        ) : null}
                        {c.conditions.length ? (
                          <>
                            {" "}
                            • <span style={{ color: "#ffdf9a" }}>{c.conditions.join(", ")}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {isDm ? (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          value={String(c.initiative)}
                          onChange={(e) => updateCombatant(c.id, { initiative: safeInt(e.target.value, 0) })}
                          inputMode="numeric"
                          style={{ ...miniInput, width: 74 }}
                          title="Initiative"
                        />
                        <input
                          value={typeof c.ac === "number" ? String(c.ac) : ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            updateCombatant(c.id, { ac: v ? safeInt(v, 0) : undefined });
                          }}
                          inputMode="numeric"
                          style={{ ...miniInput, width: 74 }}
                          placeholder="AC"
                          title="AC"
                        />
                        <input
                          value={typeof c.hp === "number" ? String(c.hp) : ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            updateCombatant(c.id, { hp: v ? safeInt(v, 0) : undefined });
                          }}
                          inputMode="numeric"
                          style={{ ...miniInput, width: 74 }}
                          placeholder="HP"
                          title="HP"
                        />
                        <input
                          value={typeof c.maxHp === "number" ? String(c.maxHp) : ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            updateCombatant(c.id, { maxHp: v ? safeInt(v, 0) : undefined });
                          }}
                          inputMode="numeric"
                          style={{ ...miniInput, width: 74 }}
                          placeholder="Max"
                          title="Max HP"
                        />

                        <button onClick={() => removeCombatant(c.id)} style={dangerBtnSmall} title="Remove">
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div style={card}>
                <p style={{ opacity: 0.85 }}>No combatants yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function HpPill({ c }: { c: Combatant }) {
  const hp = typeof c.hp === "number" ? c.hp : undefined;
  const max = typeof c.maxHp === "number" ? c.maxHp : undefined;

  if (hp === undefined && max === undefined) {
    return <span style={{ opacity: 0.7 }}>—</span>;
  }

  const label = hp === undefined ? `—/${max}` : max === undefined ? `${hp}` : `${hp}/${max}`;
  return <span style={{ ...pill, background: "rgba(255,255,255,0.07)" }}>{label}</span>;
}

function HpAdjust({ c, onChange }: { c: Combatant; onChange: (nextHp: number) => void }) {
  const hp = typeof c.hp === "number" ? c.hp : 0;
  const max = typeof c.maxHp === "number" ? c.maxHp : undefined;

  const step = 1;
  const dec = () => {
    const next = hp - step;
    onChange(max !== undefined ? clamp(next, 0, max) : next);
  };
  const inc = () => {
    const next = hp + step;
    onChange(max !== undefined ? clamp(next, 0, max) : next);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <button style={ghostBtnSmall} onClick={dec} title="-1 HP">
        -
      </button>
      <button style={ghostBtnSmall} onClick={inc} title="+1 HP">
        +
      </button>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 16,
  padding: "1.15rem",
  background: "rgba(10,10,10,0.55)",
  backdropFilter: "blur(4px)",
};

const subCard: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 14,
  background: "rgba(0,0,0,0.2)",
};

const row: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 16,
  padding: "0.9rem",
  background: "rgba(10,10,10,0.55)",
  backdropFilter: "blur(4px)",
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "1rem",
  alignItems: "center",
};

const label: React.CSSProperties = {
  fontSize: "0.85rem",
  opacity: 0.85,
  marginBottom: "0.25rem",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 12,
  border: "1px solid #222",
  outline: "none",
  background: "rgba(255,255,255,0.05)",
  color: "#f5f5f5",
};

const select: React.CSSProperties = {
  ...input,
  padding: "0.62rem 0.75rem",
};

const miniInput: React.CSSProperties = {
  padding: "0.45rem 0.55rem",
  borderRadius: 12,
  border: "1px solid #222",
  outline: "none",
  background: "rgba(255,255,255,0.05)",
  color: "#f5f5f5",
};

const btn: React.CSSProperties = {
  padding: "0.65rem 0.9rem",
  borderRadius: 14,
  border: "1px solid #2a2a2a",
  background: "rgba(212,175,55,0.18)",
  color: "#f5f5f5",
  cursor: "pointer",
  fontWeight: 700,
};

const ghostBtn: React.CSSProperties = {
  ...btn,
  background: "rgba(255,255,255,0.06)",
  fontWeight: 650,
};

const dangerBtn: React.CSSProperties = {
  ...btn,
  background: "rgba(255, 80, 80, 0.16)",
  border: "1px solid rgba(255, 80, 80, 0.25)",
};

const ghostBtnSmall: React.CSSProperties = {
  ...ghostBtn,
  padding: "0.45rem 0.6rem",
  borderRadius: 12,
  fontWeight: 700,
};

const dangerBtnSmall: React.CSSProperties = {
  ...dangerBtn,
  padding: "0.45rem 0.6rem",
  borderRadius: 12,
  fontWeight: 700,
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.28rem 0.6rem",
  borderRadius: 999,
  border: "1px solid #222",
  background: "rgba(255,255,255,0.06)",
  fontSize: "0.85rem",
};

const condPill: React.CSSProperties = {
  ...pill,
  background: "rgba(255,255,255,0.05)",
};
