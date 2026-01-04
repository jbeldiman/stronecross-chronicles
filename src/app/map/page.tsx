"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_SESSION_KEY = "stonecross.session.v1";
const DM_USERNAME = "jbeldiman";

type TownId =
  | "stonecross"
  | "stormwatch"
  | "westhaven"
  | "eldergate"
  | "sunspire"
  | "ashenmoor"
  | "shatteredisles"
  | "greenshadow";

type Town = {
  id: TownId;
  name: string;
  x: number;
  y: number;
  mapSrc?: string;
  summary?: string;
  npcs?: { name: string; location: string; note?: string }[];
};

type Session = {
  username: string;
  loggedInAt?: string;
};

type UnlockState = {
  unlocked: TownId[];
  lastUpdatedAt: string;
};

const STORAGE_UNLOCKS = "stonecross.map.unlocks.v1";
const DEFAULT_UNLOCKED: TownId[] = ["stonecross", "stormwatch", "westhaven"];

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

function loadUnlockedLocal(): TownId[] {
  try {
    const raw = localStorage.getItem(STORAGE_UNLOCKS);
    if (!raw) return DEFAULT_UNLOCKED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_UNLOCKED;
    return parsed as TownId[];
  } catch {
    return DEFAULT_UNLOCKED;
  }
}

function saveUnlockedLocal(ids: TownId[]) {
  localStorage.setItem(STORAGE_UNLOCKS, JSON.stringify(ids));
}

async function fetchRemote(room: string): Promise<UnlockState | null> {
  const res = await fetch(`/api/map-unlocks?room=${encodeURIComponent(room)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: UnlockState | null };
  return json.data ?? null;
}

async function pushRemote(room: string, state: UnlockState): Promise<void> {
  await fetch(`/api/map-unlocks?room=${encodeURIComponent(room)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

export default function MapPage() {
  const router = useRouter();

  const [isClient, setIsClient] = useState(false);
  const [room, setRoom] = useState("default");

  const [session, setSession] = useState<Session | null>(null);
  const [unlocked, setUnlocked] = useState<TownId[]>(DEFAULT_UNLOCKED);
  const [selected, setSelected] = useState<Town | null>(null);

  const [playerPreview, setPlayerPreview] = useState(false);

  const lastRemoteStamp = useRef<string>("");

  const towns: Town[] = useMemo(
    () => [
      {
        id: "stonecross",
        name: "Stonecross",
        x: 50,
        y: 10,
        mapSrc: "/maps/towns/stonecross.jpg",
        summary: "Mountain-ward stronghold and the heart of the realm.",
        npcs: [
          { name: "Captain of the Watch", location: "Gatehouse", note: "Keeps order." },
          { name: "Archivist", location: "Hall of Records", note: "Knows old lore." },
        ],
      },
      {
        id: "stormwatch",
        name: "Stormwatch",
        x: 23,
        y: 33,
        mapSrc: "/maps/towns/stormwatch.jpg",
        summary: "A lonely tower-town guarding the northern pass.",
        npcs: [{ name: "Harbormaster", location: "Docks", note: "Sees everything." }],
      },
      {
        id: "westhaven",
        name: "Westhaven",
        x: 18,
        y: 55,
        mapSrc: "/maps/towns/westhaven.jpg",
        summary: "Coastal port with salt air and sharper politics.",
        npcs: [{ name: "Innkeeper", location: "The Gilded Gull", note: "Hears rumors nightly." }],
      },
      {
        id: "greenshadow",
        name: "Greenshadow Forest",
        x: 42,
        y: 58,
        mapSrc: "/maps/towns/greenshadow.jpg",
        summary: "Ancient forest paths and hidden shrines.",
      },
      {
        id: "eldergate",
        name: "Eldergate",
        x: 40,
        y: 80,
        mapSrc: "/maps/towns/eldergate.jpg",
        summary: "Old stone city with catacombs beneath.",
      },
      {
        id: "sunspire",
        name: "Sunspire",
        x: 62,
        y: 62,
        mapSrc: "/maps/towns/sunspire.jpg",
        summary: "Golden spires, trade routes, and bright banners.",
      },
      {
        id: "ashenmoor",
        name: "Ashen Moor",
        x: 86,
        y: 64,
        mapSrc: "/maps/towns/ashenmoor.jpg",
        summary: "Volcanic badlands and smoke-choked ruins.",
      },
      {
        id: "shatteredisles",
        name: "Shattered Isles",
        x: 12,
        y: 84,
        mapSrc: "/maps/towns/shatteredisles.jpg",
        summary: "Broken archipelago haunted by old wrecks.",
      },
    ],
    []
  );

  useEffect(() => {
    setIsClient(true);

    const sp = new URLSearchParams(window.location.search);
    const r = (sp.get("room") || "default").trim() || "default";
    setRoom(r);

    const s = loadSession();
    if (!s) {
      router.replace(`/login?next=/map?room=${encodeURIComponent(r)}`);
      return;
    }
    setSession(s);

    const local = loadUnlockedLocal();
    setUnlocked(local);
  }, []);

  const isDm = session?.username === DM_USERNAME;
  const effectiveIsDm = Boolean(isDm && !playerPreview);

  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);

  useEffect(() => {
    if (!isClient || !session) return;

    (async () => {
      const remote = await fetchRemote(room);
      if (remote?.unlocked) {
        lastRemoteStamp.current = remote.lastUpdatedAt || "";
        setUnlocked(remote.unlocked);
        saveUnlockedLocal(remote.unlocked);
      } else if (isDm) {
        const seed: UnlockState = { unlocked: loadUnlockedLocal(), lastUpdatedAt: new Date().toISOString() };
        await pushRemote(room, seed);
        lastRemoteStamp.current = seed.lastUpdatedAt;
      }
    })();
  }, [isClient, session, room, isDm]);

  useEffect(() => {
    if (!isClient || !session) return;
    if (isDm) return;

    const t = window.setInterval(async () => {
      const remote = await fetchRemote(room);
      if (!remote) return;
      const stamp = remote.lastUpdatedAt || "";
      if (stamp && stamp !== lastRemoteStamp.current) {
        lastRemoteStamp.current = stamp;
        setUnlocked(remote.unlocked || DEFAULT_UNLOCKED);
        saveUnlockedLocal(remote.unlocked || DEFAULT_UNLOCKED);
      }
    }, 1500);

    return () => window.clearInterval(t);
  }, [isClient, session, room, isDm]);

  function toggleUnlock(id: TownId) {
    if (!effectiveIsDm) return;

    setUnlocked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveUnlockedLocal(next);

      const state: UnlockState = { unlocked: next, lastUpdatedAt: new Date().toISOString() };
      pushRemote(room, state);
      lastRemoteStamp.current = state.lastUpdatedAt;

      return next;
    });
  }

  if (!isClient || !session) {
    return (
      <main className="sc-page">
        <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/home.jpg')" }} />
        <div className="sc-overlay" />
        <div className="sc-content" style={{ padding: "2rem" }}>
          <h1>World Map</h1>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/map.jpg')" }} />
      <div className="sc-overlay" />
      <div className="sc-content" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h1 style={{ marginBottom: "0.25rem" }}>World Map</h1>
            <p style={{ opacity: 0.85 }}>Click a location to view details. Some locations may be locked.</p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ opacity: 0.75, fontSize: "0.95rem" }}>
              Logged in as <strong>{session.username}</strong>
            </span>

            {isDm ? (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.45rem 0.65rem",
                  border: "1px solid #222",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.25)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                title="Preview what players see (DM powers disabled while enabled)"
              >
                <span style={{ opacity: 0.9, fontSize: "0.9rem" }}>Player View</span>
                <input type="checkbox" checked={playerPreview} onChange={(e) => setPlayerPreview(e.target.checked)} />
              </label>
            ) : null}
          </div>
        </div>

        {playerPreview ? (
          <div style={{ ...cardStyle, marginTop: "1rem", borderStyle: "dashed" }}>
            <strong>Player View Enabled</strong>
            <div style={{ opacity: 0.85, marginTop: "0.25rem" }}>DM powers are temporarily disabled so you can preview what players see.</div>
          </div>
        ) : null}

        <section style={{ ...cardStyle, marginTop: "1rem" }}>
          <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden" }}>
            <img
              src="/maps/world/stonecross-world-map.jpg"
              alt="Stonecross World Map"
              style={{ width: "100%", display: "block" }}
              draggable={false}
            />

            {towns.map((t) => {
              const unlockedTown = unlockedSet.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (!unlockedTown && !effectiveIsDm) return;
                    setSelected(t);
                  }}
                  title={unlockedTown || effectiveIsDm ? t.name : `${t.name} (Locked)`}
                  style={{
                    position: "absolute",
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    border: unlockedTown || effectiveIsDm ? "2px solid rgba(255,255,255,0.9)" : "2px solid rgba(255,255,255,0.25)",
                    background: unlockedTown || effectiveIsDm ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.65)",
                    cursor: unlockedTown || effectiveIsDm ? "pointer" : "not-allowed",
                    backdropFilter: "blur(2px)",
                    boxShadow: unlockedTown || effectiveIsDm ? "0 0 0 3px rgba(212,175,55,0.12)" : "none",
                    opacity: unlockedTown || effectiveIsDm ? 1 : 0.6,
                  }}
                />
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginTop: "0.75rem" }}>
            <p style={{ opacity: 0.8, margin: 0 }}>
              Room: <strong>{room}</strong> • Shared unlocks • Players update in ~1–2s
            </p>

            {effectiveIsDm ? (
              <span style={{ opacity: 0.85 }}>
                DM Mode: <strong>Unlock controls enabled</strong>
              </span>
            ) : (
              <span style={{ opacity: 0.75 }}>Explore to unlock more locations.</span>
            )}
          </div>
        </section>

        {isDm && !playerPreview ? (
          <section style={{ ...cardStyle, marginTop: "1rem" }}>
            <h2 style={h2}>DM Unlocks</h2>
            <p style={{ opacity: 0.8, marginBottom: "0.75rem" }}>Toggle which locations are visible to players.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {towns.map((t) => {
                const on = unlockedSet.has(t.id);
                return (
                  <label
                    key={`unlock-${t.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #222",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.25)",
                    }}
                  >
                    <span>{t.name}</span>
                    <input type="checkbox" checked={on} onChange={() => toggleUnlock(t.id)} />
                  </label>
                );
              })}
            </div>
          </section>
        ) : null}

        {selected && (
          <div
            onClick={() => setSelected(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(100%, 1100px)",
                background: "#0f0f0f",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  padding: "0.9rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                <div>
                  <strong style={{ color: "white", fontSize: "1.05rem" }}>{selected.name}</strong>
                  {selected.summary ? (
                    <div style={{ opacity: 0.8, fontSize: "0.9rem", marginTop: "0.15rem" }}>{selected.summary}</div>
                  ) : null}
                </div>

                <button onClick={() => setSelected(null)} style={btnStyle}>
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 0 }}>
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                  {selected.mapSrc ? (
                    <img
                      src={selected.mapSrc}
                      alt={`${selected.name} map`}
                      style={{ width: "100%", display: "block", maxHeight: "70vh", objectFit: "contain", background: "#0b0b0b" }}
                      draggable={false}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={{ padding: "1rem", opacity: 0.8 }}>No town map image set yet.</div>
                  )}
                </div>

                <div style={{ padding: "1rem" }}>
                  <h3 style={h3}>Important NPCs</h3>

                  {selected.npcs && selected.npcs.length ? (
                    <ul style={{ paddingLeft: "1rem", marginTop: "0.5rem" }}>
                      {selected.npcs.map((n) => (
                        <li key={`${selected.id}-${n.name}`} style={{ margin: "0.35rem 0" }}>
                          <strong>{n.name}</strong> <span style={{ opacity: 0.8 }}>— {n.location}</span>
                          {n.note ? <div style={{ opacity: 0.75, fontSize: "0.92rem", marginTop: "0.15rem" }}>{n.note}</div> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ opacity: 0.8, marginTop: "0.5rem" }}>No NPCs listed yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 16,
  padding: "1rem",
  background: "rgba(10,10,10,0.55)",
  backdropFilter: "blur(4px)",
};

const btnStyle: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  borderRadius: 12,
  border: "1px solid #333",
  background: "rgba(212,175,55,0.12)",
  color: "white",
  cursor: "pointer",
};

const h2: React.CSSProperties = { fontSize: "1.2rem", marginBottom: "0.75rem" };
const h3: React.CSSProperties = { fontSize: "1.05rem", marginBottom: "0.25rem" };
