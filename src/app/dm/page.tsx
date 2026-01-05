"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function DmPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [sheet, setSheet] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const isDm = session?.username === DM_USERNAME;

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login?next=/dm");
      return;
    }
    setSession(s);
  }, [router]);

  async function refreshUsers(actor: string) {
    const res = await fetch("/api/users", { headers: { "x-sc-user": actor } });
    if (!res.ok) throw new Error("Failed to load users");
    const data = (await res.json()) as { users: string[] };
    setUsers(data.users || []);
  }

  async function loadCharacter(actor: string, username: string) {
    const res = await fetch(`/api/character?username=${encodeURIComponent(username)}`, {
      headers: { "x-sc-user": actor },
    });
    if (!res.ok) throw new Error("Failed to load character");
    const data = (await res.json()) as { sheet: any };
    setSheet(data.sheet ?? null);
  }

  useEffect(() => {
    if (!session) return;
    if (!isDm) {
      router.replace("/");
      return;
    }

    (async () => {
      try {
        setError("");
        await refreshUsers(session.username);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      }
    })();
  }, [session, isDm, router]);

  const selectedLabel = useMemo(() => {
    if (!selectedUser) return "Select a player";
    return selectedUser;
  }, [selectedUser]);

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

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/character.jpg')" }} />
      <div className="sc-overlay" />
      <div className="sc-content" style={{ padding: "2rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
          <div>
            <h1 style={{ marginBottom: "0.25rem" }}>DM</h1>
            <p style={{ opacity: 0.85, margin: 0 }}>
              Logged in as <strong>{session.username}</strong>
            </p>
          </div>

          <button
            onClick={async () => {
              try {
                setError("");
                await refreshUsers(session.username);
              } catch (e: any) {
                setError(e?.message || "Failed to refresh");
              }
            }}
            style={btn}
          >
            Refresh
          </button>
        </header>

        {error ? (
          <div style={{ ...card, marginTop: "1rem", borderColor: "rgba(255, 80, 80, 0.35)" }}>
            <strong style={{ color: "#ffb4b4" }}>{error}</strong>
          </div>
        ) : null}

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
