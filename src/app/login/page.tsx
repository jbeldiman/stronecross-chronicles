"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const AUTH_SESSION_KEY = "stonecross.session.v1";

function normalizeUsername(v: string) {
  return v.trim().toLowerCase();
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function apiSignup(username: string, passwordHash: string) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, passwordHash }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function apiLogin(username: string, passwordHash: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, passwordHash }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const next = useMemo(() => {
    const paramNext = params.get("next");
    if (paramNext) return paramNext;

    try {
      const session = localStorage.getItem(AUTH_SESSION_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed?.username === "jbeldiman") return "/dm";
      }
    } catch {}

    return "/character";
  }, [params]);

  useEffect(() => {
    const existing = localStorage.getItem(AUTH_SESSION_KEY);
    if (existing) router.replace(next);
  }, [router, next]);

  async function handleSubmit() {
    setError("");
    setBusy(true);
    try {
      const u = normalizeUsername(username);
      const p = password;

      if (!u) {
        setError("Please enter a username.");
        return;
      }
      if (!p || p.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      const hash = await sha256Hex(`${u}:${p}`);

      if (mode === "signup") {
        const r = await apiSignup(u, hash);
        if (!r.ok) {
          if (r.status === 409) setError("That username already exists. Try logging in instead.");
          else setError("Signup failed. Try again.");
          return;
        }

        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ username: u, loggedInAt: new Date().toISOString() }));
        router.replace(next);
        return;
      }

      const r = await apiLogin(u, hash);
      if (!r.ok) {
        if (r.status === 404) setError("Account not found. Switch to Create Account to register.");
        else if (r.status === 401) setError("Incorrect password.");
        else setError("Login failed. Try again.");
        return;
      }

      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ username: u, loggedInAt: new Date().toISOString() }));
      router.replace(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/home.jpg')" }} />
      <div className="sc-overlay" />
      <div className="sc-content" style={{ padding: "2rem" }}>
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h1 style={{ marginBottom: "0.25rem" }}>{mode === "login" ? "Log in" : "Create account"}</h1>
              <p style={{ opacity: 0.85, marginBottom: "1rem" }}>
                {mode === "login" ? "Log in to access your character." : "Create an account to save your character."}
              </p>
            </div>

            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={ghostBtnStyle}
              disabled={busy}
            >
              {mode === "login" ? "Create account" : "Have an account?"}
            </button>
          </div>

          <label style={{ display: "block" }}>
            <div style={labelStyle}>Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., rangerqueen"
              style={inputStyle}
              autoComplete="username"
              disabled={busy}
            />
          </label>

          <label style={{ display: "block", marginTop: "0.75rem" }}>
            <div style={labelStyle}>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              disabled={busy}
            />
          </label>

          {error ? <p style={{ marginTop: "0.75rem", color: "#ffb4b4" }}>{error}</p> : null}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button onClick={handleSubmit} style={btnStyle} disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create"}
            </button>

            <button
              onClick={() => router.push("/")}
              style={{ ...btnStyle, background: "rgba(255,255,255,0.06)" }}
              disabled={busy}
            >
              Back to Home
            </button>

            <button
              onClick={() => router.push("/logout")}
              style={{ ...btnStyle, background: "rgba(255, 80, 80, 0.16)", border: "1px solid rgba(255, 80, 80, 0.25)" }}
              disabled={busy}
            >
              Log out
            </button>
          </div>

          <p style={{ marginTop: "1rem", opacity: 0.75, lineHeight: 1.35 }}>
            You’ll be redirected to: <strong>{next}</strong>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="sc-page" style={{ padding: "2rem" }} />}>
      <LoginInner />
    </Suspense>
  );
}

const cardStyle: React.CSSProperties = {
  maxWidth: 560,
  border: "1px solid #222",
  borderRadius: 16,
  padding: "1.25rem",
  background: "rgba(10,10,10,0.55)",
  backdropFilter: "blur(4px)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  opacity: 0.85,
  marginBottom: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.8rem",
  borderRadius: 12,
  border: "1px solid #333",
  background: "rgba(0,0,0,0.45)",
  color: "white",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "0.7rem 0.9rem",
  borderRadius: 12,
  border: "1px solid #333",
  background: "rgba(212,175,55,0.12)",
  color: "white",
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  borderRadius: 12,
  border: "1px solid #333",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  height: "fit-content",
};
