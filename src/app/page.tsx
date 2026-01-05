"use client";

import React, { useEffect, useState } from "react";

const AUTH_SESSION_KEY = "stonecross.session.v1";
const DM_USERNAME = "jbeldiman";

type Session = { username: string; loggedInAt?: string };

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
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const isDm = session?.username?.toLowerCase() === DM_USERNAME;

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/home.jpg')" }} />
      <div className="sc-overlay" />

      <div className="sc-content" style={{ padding: "2rem" }}>
        <h1>Stonecross Chronicles</h1>
        <p>Welcome. Choose where to go:</p>
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
