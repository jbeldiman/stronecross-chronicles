"use client";

import React, { useEffect, useMemo, useState } from "react";

const AUTH_SESSION_KEY = "stonecross.session.v1";
const DM_USERNAME = "jbeldiman";
const ROOM = "default";

type RevealMode = "hidden" | "teaser" | "full";

type OldGod = {
  id: string;
  name: string;
  realm: string;
  followers: string;
  partyInteractions: string;

  
  revealMode: RevealMode; 
};

type OldGodsState = {
  updatedAt: string;
  gods: OldGod[];
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadSessionUsername(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const u = (parsed?.username || "").toString().trim().toLowerCase();
    return u || null;
  } catch {
    return null;
  }
}

function emptyState(): OldGodsState {
  return {
    updatedAt: new Date().toISOString(),
    gods: [
      {
        id: uid(),
        name: "Thalassyr",
        realm: "The Deep Tides",
        followers: "Sailors, stormcallers, sea-cults",
        partyInteractions: "Rodney made an offering; a pact was acknowledged.",
        revealMode: "full",
      },
    ],
  };
}

function normalizeState(raw: OldGodsState | null): OldGodsState | null {
  if (!raw || !Array.isArray(raw.gods)) return null;

  const safeMode = (v: unknown): RevealMode => {
    if (v === "hidden" || v === "teaser" || v === "full") return v;
    return "full";
  };

  return {
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    gods: raw.gods
      .filter((g) => typeof g === "object" && g !== null)
      .map((g: any) => ({
        id: typeof g.id === "string" ? g.id : uid(),
        name: typeof g.name === "string" ? g.name : "",
        realm: typeof g.realm === "string" ? g.realm : "",
        followers: typeof g.followers === "string" ? g.followers : "",
        partyInteractions: typeof g.partyInteractions === "string" ? g.partyInteractions : "",
        revealMode: safeMode(g.revealMode),
      })),
  };
}

async function fetchOldGods(): Promise<OldGodsState | null> {
  const res = await fetch(`/api/old-gods?room=${encodeURIComponent(ROOM)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: OldGodsState | null };
  return json.data ?? null;
}

async function saveOldGods(next: OldGodsState): Promise<boolean> {
  const res = await fetch(`/api/old-gods?room=${encodeURIComponent(ROOM)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
  return res.ok;
}

function modeLabel(m: RevealMode) {
  if (m === "hidden") return "Hidden";
  if (m === "teaser") return "Teaser";
  return "Full";
}

export default function OldGodsPage() {
  const [sessionUsername, setSessionUsername] = useState<string | null>(null);
  const [state, setState] = useState<OldGodsState>(() => emptyState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDM = useMemo(() => sessionUsername === DM_USERNAME, [sessionUsername]);

  useEffect(() => {
    setSessionUsername(loadSessionUsername());
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      const remoteRaw = await fetchOldGods();
      if (!mounted) return;

      const remote = normalizeState(remoteRaw);
      if (remote) setState(remote);

      setLoading(false);
    })().catch(() => {
      if (!mounted) return;
      setError("Failed to load Old Gods data.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  function updateGod(id: string, patch: Partial<OldGod>) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      gods: prev.gods.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function addGod() {
    const g: OldGod = {
      id: uid(),
      name: "New God",
      realm: "",
      followers: "",
      partyInteractions: "",
      revealMode: "hidden", 
    };
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      gods: [g, ...prev.gods],
    }));
  }

  function removeGod(id: string) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      gods: prev.gods.filter((g) => g.id !== id),
    }));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    const ok = await saveOldGods({ ...state, updatedAt: new Date().toISOString() });
    setSaving(false);
    if (!ok) setError("Save failed. (Is KV configured in Vercel env vars?)");
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid #222",
    borderRadius: 12,
    padding: "1rem",
    background: "#0b0b0b",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.7rem",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 6,
  };

  const buttonStyle: React.CSSProperties = {
    padding: "0.6rem 0.8rem",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  };

  const pillStyle: React.CSSProperties = {
    fontSize: 12,
    padding: "0.25rem 0.5rem",
    borderRadius: 999,
    border: "1px solid #2a2a2a",
    background: "#111",
    opacity: 0.95,
  };

  const playerVisibleGods = useMemo(() => state.gods.filter((g) => g.revealMode !== "hidden"), [state.gods]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>The Old Gods</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {loading ? "Loading..." : `Last updated: ${new Date(state.updatedAt).toLocaleString()}`}
          </div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>{isDM ? "DM Mode: editing enabled" : "Player Mode"}</div>
        </div>

        {isDM ? (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button style={buttonStyle} onClick={addGod} disabled={saving}>
              + Add
            </button>
            <button style={buttonStyle} onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #331", borderRadius: 10 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: "1rem" }}>
        {(isDM ? state.gods : playerVisibleGods).map((g) => {
          const isHiddenToPlayers = g.revealMode === "hidden";
          const isTeaser = g.revealMode === "teaser";
          const isFull = g.revealMode === "full";
          const playerTitle = isTeaser ? "Unknown Old God" : g.name || "Unnamed God";

          return (
            <div key={g.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {isDM ? g.name || "Unnamed God" : playerTitle}
                  </div>

                  {isDM ? (
                    <span style={pillStyle}>
                      Player visibility: <strong>{modeLabel(g.revealMode)}</strong>
                    </span>
                  ) : isTeaser ? (
                    <span style={pillStyle}>Teaser</span>
                  ) : null}
                </div>

                {isDM ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={g.revealMode}
                      onChange={(e) => updateGod(g.id, { revealMode: e.target.value as RevealMode })}
                      disabled={saving}
                      style={{ ...inputStyle, width: 190, padding: "0.55rem 0.65rem" }}
                      title="Player visibility"
                    >
                      <option value="hidden">Hidden (not visible)</option>
                      <option value="teaser">Teaser (limited info)</option>
                      <option value="full">Full (everything)</option>
                    </select>

                    <button style={buttonStyle} onClick={() => removeGod(g.id)} disabled={saving}>
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <div style={labelStyle}>Name</div>
                  {isDM ? (
                    <input style={inputStyle} value={g.name} onChange={(e) => updateGod(g.id, { name: e.target.value })} />
                  ) : isTeaser ? (
                    <div>—</div>
                  ) : (
                    <div>{g.name || "—"}</div>
                  )}
                </div>

                <div>
                  <div style={labelStyle}>Realm</div>
                  {isDM ? (
                    <input style={inputStyle} value={g.realm} onChange={(e) => updateGod(g.id, { realm: e.target.value })} />
                  ) : (
                    <div>{g.realm || "—"}</div>
                  )}
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={labelStyle}>Known Followers</div>
                  {isDM ? (
                    <textarea
                      style={{ ...inputStyle, minHeight: 60 }}
                      value={g.followers}
                      onChange={(e) => updateGod(g.id, { followers: e.target.value })}
                    />
                  ) : isFull ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{g.followers || "—"}</div>
                  ) : (
                    <div>—</div>
                  )}
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={labelStyle}>Previous Interactions with the Party</div>
                  {isDM ? (
                    <textarea
                      style={{ ...inputStyle, minHeight: 90 }}
                      value={g.partyInteractions}
                      onChange={(e) => updateGod(g.id, { partyInteractions: e.target.value })}
                    />
                  ) : isFull ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{g.partyInteractions || "—"}</div>
                  ) : (
                    <div>—</div>
                  )}
                </div>
              </div>

              {isDM && isHiddenToPlayers ? (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  Players will not see this entry at all until you switch it to Teaser or Full.
                </div>
              ) : null}
            </div>
          );
        })}

        {!loading && (isDM ? state.gods.length === 0 : playerVisibleGods.length === 0) ? (
          <div style={{ opacity: 0.8 }}>No Old Gods are visible yet.</div>
        ) : null}
      </div>
    </div>
  );
}
