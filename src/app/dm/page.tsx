"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_SESSION_KEY = "stonecross.session.v1";
const DM_USERNAME = "jbeldiman";

type Session = {
  username: string;
  loggedInAt?: string;
};

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.username) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

type TownId =
  | "stonecross"
  | "stormwatch"
  | "westhaven"
  | "eldergate"
  | "sunspire"
  | "ashenmoor"
  | "shatteredisles"
  | "greenshadow";

type NPC = {
  id: string;
  name: string;
  title: string;
  townId: TownId;
  comments?: string;
  createdAt: string;
  updatedAt: string;
};

type NPCState = {
  npcs: NPC[];
  lastUpdatedAt: string;
};

function getRoomFromUrl(): string {
  try {
    const sp = new URLSearchParams(window.location.search);
    const r = (sp.get("room") || "default").trim() || "default";
    return r;
  } catch {
    return "default";
  }
}

const TOWNS: { id: TownId; name: string }[] = [
  { id: "stonecross", name: "Stonecross" },
  { id: "stormwatch", name: "Stormwatch" },
  { id: "westhaven", name: "Westhaven" },
  { id: "greenshadow", name: "Greenshadow Forest" },
  { id: "eldergate", name: "Eldergate" },
  { id: "sunspire", name: "Sunspire" },
  { id: "ashenmoor", name: "Ashen Moor" },
  { id: "shatteredisles", name: "Shattered Isles" },
];

async function fetchNPCs(room: string): Promise<NPCState | null> {
  const res = await fetch(`/api/npcs?room=${encodeURIComponent(room)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: NPCState | null };
  return json.data ?? null;
}

async function upsertNPC(room: string, npc: Partial<NPC> & { name: string; title: string; townId: TownId }): Promise<NPCState | null> {
  const res = await fetch(`/api/npcs?room=${encodeURIComponent(room)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "upsert", npc }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: NPCState | null };
  return json.data ?? null;
}

async function deleteNPC(room: string, id: string): Promise<NPCState | null> {
  const res = await fetch(`/api/npcs?room=${encodeURIComponent(room)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "delete", id }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: NPCState | null };
  return json.data ?? null;
}

export default function DmPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const [room, setRoom] = useState<string>("default");

  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [sheet, setSheet] = useState<any>(null);
  const [error, setError] = useState<string>("");


  const [npcState, setNpcState] = useState<NPCState>({ npcs: [], lastUpdatedAt: "" });
  const lastNpcStamp = useRef<string>("");

  const [npcName, setNpcName] = useState("");
  const [npcTitle, setNpcTitle] = useState("");
  const [npcTownId, setNpcTownId] = useState<TownId>("stonecross");
  const [npcComments, setNpcComments] = useState("");
  const [npcBusy, setNpcBusy] = useState(false);

  const isDm = session?.username === DM_USERNAME;

  useEffect(() => {
    const s = loadSession();
    if (!s) {
     
      const r = typeof window !== "undefined" ? getRoomFromUrl() : "default";
      router.replace(`/login?next=/dm?room=${encodeURIComponent(r)}`);
      return;
    }
    if (s.username !== DM_USERNAME) {
      router.replace("/");
      return;
    }
    setSession(s);

    const r = typeof window !== "undefined" ? getRoomFromUrl() : "default";
    setRoom(r);
  }, [router]);

  async function refreshUsers(actor: string) {
    const res = await fetch("/api/users", { headers: { "x-sc-user": actor } });
    if (!res.ok) throw new Error("Failed to load users");
    const data = (await res.json()) as { users: string[] };
    setUsers((data.users || []).filter((u) => u && u !== DM_USERNAME));
  }

  async function loadCharacter(actor: string, username: string) {
    const res = await fetch(`/api/character?username=${encodeURIComponent(username)}`, {
      headers: { "x-sc-user": actor },
    });
    if (!res.ok) throw new Error("Failed to load character");
    const data = (await res.json()) as { sheet: any };
    setSheet(data.sheet ?? null);
  }

  async function refreshNPCs() {
    const remote = await fetchNPCs(room);
    if (!remote) throw new Error("Failed to load NPCs");
    lastNpcStamp.current = remote.lastUpdatedAt || "";
    setNpcState(remote);
  }

  useEffect(() => {
    if (!session) return;

    (async () => {
      try {
        setError("");
        await refreshUsers(session.username);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      }
    })();
  }, [session]);

  useEffect(() => {
    if (!session) return;

    (async () => {
      try {
        setError("");
        await refreshNPCs();
      } catch (e: any) {
        setError(e?.message || "Failed to load NPCs");
      }
    })();
  }, [session, room]);

  const selectedLabel = useMemo(() => {
    if (!selectedUser) return "Select a player";
    return selectedUser;
  }, [selectedUser]);

  const npcCountByTown = useMemo(() => {
    const m = new Map<TownId, number>();
    for (const n of npcState.npcs) m.set(n.townId, (m.get(n.townId) || 0) + 1);
    return m;
  }, [npcState.npcs]);

  if (!session) {
    return (
      <main className="sc-page">
        <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/home.jpg')" }} />
        <div className="sc-overlay" />
        <div className="sc-content" style={{ padding: "2rem" }}>
          <h1>DM</h1>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (!isDm) return null;

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/character.jpg')" }} />
      <div className="sc-overlay" />
      <div className="sc-content" style={{ padding: "2rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ marginBottom: "0.25rem" }}>DM</h1>
            <p style={{ opacity: 0.85, margin: 0 }}>
              Logged in as <strong>{session.username}</strong> • Room: <strong>{room}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                try {
                  setError("");
                  await refreshUsers(session.username);
                } catch (e: any) {
                  setError(e?.message || "Failed to refresh users");
                }
              }}
              style={btn}
            >
              Refresh Users
            </button>

            <button
              onClick={async () => {
                try {
                  setError("");
                  await refreshNPCs();
                } catch (e: any) {
                  setError(e?.message || "Failed to refresh NPCs");
                }
              }}
              style={btn}
            >
              Refresh NPCs
            </button>
          </div>
        </header>

        {error ? (
          <div style={{ ...card, marginTop: "1rem", borderColor: "rgba(255, 80, 80, 0.35)" }}>
            <strong style={{ color: "#ffb4b4" }}>{error}</strong>
          </div>
        ) : null}

        {/* NPC Manager */}
        <section style={{ ...card, marginTop: "1rem" }}>
          <h2 style={h2}>NPC Manager</h2>
          <p style={{ opacity: 0.85, marginTop: "-0.25rem" }}>
            Add NPCs and assign them to a location. Players will see these on the Map screen for the same room.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
            <div>
              <label style={label}>Name</label>
              <input
                value={npcName}
                onChange={(e) => setNpcName(e.target.value)}
                placeholder="Captain Varr"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Title</label>
              <input
                value={npcTitle}
                onChange={(e) => setNpcTitle(e.target.value)}
                placeholder="Captain of the Sun Guard"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Location</label>
              <select value={npcTownId} onChange={(e) => setNpcTownId(e.target.value as TownId)} style={input}>
                {TOWNS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({npcCountByTown.get(t.id) || 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={label}>Comments</label>
              <input
                value={npcComments}
                onChange={(e) => setNpcComments(e.target.value)}
                placeholder="Knows the smuggling routes. Suspicious of outsiders."
                style={input}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                const name = npcName.trim();
                const title = npcTitle.trim();
                if (!name || !title) {
                  setError("NPC Name and Title are required.");
                  return;
                }

                try {
                  setError("");
                  setNpcBusy(true);

                  const updated = await upsertNPC(room, {
                    name,
                    title,
                    townId: npcTownId,
                    comments: npcComments.trim() || undefined,
                  });

                  if (!updated) throw new Error("Failed to save NPC");
                  lastNpcStamp.current = updated.lastUpdatedAt || "";
                  setNpcState(updated);

                  setNpcName("");
                  setNpcTitle("");
                  setNpcComments("");
                } catch (e: any) {
                  setError(e?.message || "Failed to save NPC");
                } finally {
                  setNpcBusy(false);
                }
              }}
              style={{ ...btn, background: "rgba(212,175,55,0.12)" }}
              disabled={npcBusy}
              title="Adds the NPC to the shared room state"
            >
              {npcBusy ? "Saving..." : "Add NPC"}
            </button>

            <button
              onClick={() => {
                setNpcName("");
                setNpcTitle("");
                setNpcComments("");
                setError("");
              }}
              style={btn}
              disabled={npcBusy}
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }}>
            <h3 style={h3}>Current NPCs</h3>

            {npcState.npcs.length ? (
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
                {npcState.npcs.map((n) => {
                  const townName = TOWNS.find((t) => t.id === n.townId)?.name ?? n.townId;
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: "0.65rem 0.75rem",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(0,0,0,0.25)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "baseline" }}>
                          <strong style={{ color: "white" }}>{n.name}</strong>
                          <span style={{ opacity: 0.85 }}>— {n.title}</span>
                          <span style={{ opacity: 0.65, fontSize: "0.9rem" }}>({townName})</span>
                        </div>
                        {n.comments ? <div style={{ opacity: 0.78, marginTop: "0.25rem" }}>{n.comments}</div> : null}
                        <div style={{ opacity: 0.55, fontSize: "0.85rem", marginTop: "0.35rem" }}>
                          Updated: {new Date(n.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!confirm(`Delete NPC "${n.name}"?`)) return;
                          try {
                            setError("");
                            setNpcBusy(true);
                            const updated = await deleteNPC(room, n.id);
                            if (!updated) throw new Error("Failed to delete NPC");
                            lastNpcStamp.current = updated.lastUpdatedAt || "";
                            setNpcState(updated);
                          } catch (e: any) {
                            setError(e?.message || "Failed to delete NPC");
                          } finally {
                            setNpcBusy(false);
                          }
                        }}
                        style={{ ...btn, padding: "0.45rem 0.65rem", borderRadius: 12, background: "rgba(255,80,80,0.10)" }}
                        disabled={npcBusy}
                        title="Remove NPC from this room"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ opacity: 0.8, marginTop: "0.5rem" }}>No NPCs yet for this room.</p>
            )}
          </div>
        </section>

        {/* Existing DM tools */}
        <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1rem", marginTop: "1rem" }}>
          <div style={card}>
            <h2 style={h2}>Players</h2>

            {users.length ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {users.map((u) => (
                  <button
                    key={u}
                    onClick={async () => {
                      setSelectedUser(u);
                      setSheet(null);
                      try {
                        setError("");
                        await loadCharacter(session.username, u);
                      } catch (e: any) {
                        setError(e?.message || "Failed to load character");
                      }
                    }}
                    style={{
                      ...rowBtn,
                      borderColor: selectedUser === u ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.8, marginTop: "0.5rem" }}>No players registered yet.</p>
            )}
          </div>

          <div style={card}>
            <h2 style={h2}>Character Sheet</h2>
            <p style={{ opacity: 0.85, marginTop: "-0.25rem" }}>
              Viewing: <strong>{selectedLabel}</strong>
            </p>

            {!selectedUser ? (
              <p style={{ opacity: 0.8 }}>Pick a player on the left.</p>
            ) : sheet ? (
              <pre
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.35)",
                  overflow: "auto",
                  maxHeight: "70vh",
                  fontSize: "0.9rem",
                  lineHeight: 1.35,
                }}
              >
                {JSON.stringify(sheet, null, 2)}
              </pre>
            ) : (
              <p style={{ opacity: 0.8 }}>No sheet saved yet for this user.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 16,
  padding: "1rem",
  background: "rgba(10,10,10,0.55)",
  backdropFilter: "blur(4px)",
};

const h2: React.CSSProperties = { fontSize: "1.2rem", marginBottom: "0.75rem" };
const h3: React.CSSProperties = { fontSize: "1.05rem", marginBottom: "0.25rem" };

const btn: React.CSSProperties = {
  padding: "0.65rem 0.9rem",
  borderRadius: 14,
  border: "1px solid #2a2a2a",
  background: "rgba(255,255,255,0.06)",
  color: "#f5f5f5",
  cursor: "pointer",
  fontWeight: 650,
};

const rowBtn: React.CSSProperties = {
  textAlign: "left",
  padding: "0.65rem 0.75rem",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  cursor: "pointer",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  opacity: 0.85,
  marginBottom: "0.35rem",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.75rem",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.28)",
  color: "white",
  outline: "none",
};
