"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const AUTH_SESSION_KEY = "stonecross.session.v1";

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

  function logout() {
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {}
    setSession(null);
    router.push("/");
  }

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/home.jpg')" }} />
      <div className="sc-overlay" />

      <div className="sc-content" style={{ padding: "2rem" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Stonecross Chronicles</h1>
            <p style={{ margin: "0.35rem 0 0", opacity: 0.85 }}>
              Welcome. Choose where to go:
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {session ? (
              <>
                <span style={{ opacity: 0.85, fontSize: "0.95rem" }}>
                  Logged in as <strong>{session.username}</strong>
                </span>

                <button
                  onClick={logout}
                  title="Log out"
                  aria-label="Log out"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid #333",
                    background: "rgba(255,255,255,0.06)",
                    color: "white",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ⎋
                </button>
              </>
            ) : (
              <span style={{ opacity: 0.75, fontSize: "0.95rem" }}>Not logged in</span>
            )}
          </div>
        </header>

        <ul style={{ marginTop: "0.75rem" }}>
          <li>
            <Link href="/login">Login</Link>
          </li>
          <li>
            <Link href="/character">Character</Link>
          </li>
          <li>
            <Link href="/map">Map</Link>
          </li>
          <li>
            <Link href="/combat">Combat</Link>
          </li>
          <li>
            <Link href="/dm">DM</Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
