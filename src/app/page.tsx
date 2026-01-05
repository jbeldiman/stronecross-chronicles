"use client";

import React, { useEffect, useState } from "react";
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

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const isDm = session?.username === DM_USERNAME;

  function logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    setSession(null);
    router.push("/login");
  }

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/home.jpg')" }} />
      <div className="sc-overlay" />

      <div className="sc-content" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
          <div>
            <h1 style={{ marginBottom: "0.25rem" }}>Stonecross Chronicles</h1>
            <p style={{ opacity: 0.85, margin: 0 }}>
              {session ? (
                <>
                  Logged in as <strong>{session.username}</strong>
                </>
              ) : (
                <>Not logged in</>
              )}
            </p>
          </div>

          {session ? (
            <button
              onClick={logout}
              style={{
                border: "1px solid #333",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                borderRadius: 12,
                padding: "0.55rem 0.75rem",
                cursor: "pointer",
              }}
              title="Log out"
            >
              Log out
            </button>
          ) : null}
        </div>

        <p style={{ marginTop: "1.25rem" }}>Welcome. Choose where to go:</p>

        <ul>
          <li><a href="/login">Login</a></li>
          <li><a href="/character">Character</a></li>
          <li><a href="/map">Map</a></li>
          <li><a href="/combat">Combat</a></li>
          {isDm ? <li><a href="/dm">DM</a></li> : null}
        </ul>
      </div>
    </main>
  );
}
