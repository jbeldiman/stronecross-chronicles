"use client";

import React, { useEffect, useMemo, useState } from "react";

const AUTH_SESSION_KEY = "stonecross.session.v1";
const DM_USERNAME = "jbeldiman";
const ROOM = "default";

type OldGod = {
  id: string;
  name: string;
  realm: string;
  followers: string;
  partyInteractions: string;
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
      },
    ],
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
      const remote = await fetchOldGods();
      if (!mounted) return;

      if (remote && Array.isArray(remote.gods)) {
        setState(remote);
      } else {
        setState((prev) => prev);
      }

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

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>The Old Gods</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {loading ? "Loading..." : `Last updated: ${new Date(state.updatedAt).toLocaleString()}`}
          </div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {isDM ? "DM Mode: editing enabled" : "Player Mode: view only"}
          </div>
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
        {state.gods.map((g) => (
          <div key={g.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{g.name || "Unnamed God"}</div>
              {isDM ? (
                <button style={buttonStyle} onClick={() => removeGod(g.id)} disabled={saving}>
                  Remove
                </button>
              ) : null}
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <div style={labelStyle}>Name</div>
                {isDM ? (
                  <input
                    style={inputStyle}
                    value={g.name}
                    onChange={(e) => updateGod(g.id, { name: e.target.value })}
                  />
                ) : (
                  <div>{g.name || "—"}</div>
                )}
              </div>

              <div>
                <div style={labelStyle}>Realm</div>
                {isDM ? (
                  <input
                    style={inputStyle}
                    value={g.realm}
                    onChange={(e) => updateGod(g.id, { realm: e.target.value })}
                  />
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
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{g.followers || "—"}</div>
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
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{g.partyInteractions || "—"}</div>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && state.gods.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No Old Gods added yet.</div>
        ) : null}
      </div>
    </div>
  );
}
