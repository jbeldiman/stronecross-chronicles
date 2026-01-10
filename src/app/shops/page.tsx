"use client";

import React, { useEffect, useMemo, useState } from "react";

const AUTH_SESSION_KEY = "stonecross.session.v1";
const DM_USERNAME = "jbeldiman";
const ROOM = "default";

const CITIES = [
  "Stonecross",
  "Stormwatch",
  "Westhaven",
  "Eldergate",
  "Shattered Isles",
  "Sunspire",
  "Ashen Moor",
  "Greenshadow Forest",
] as const;

type CityName = (typeof CITIES)[number];

type ShopItem = {
  id: string;
  name: string;
  qty: number;
  priceGp: number;
  notes: string;
};

type Shop = {
  id: string;
  city: CityName;
  name: string;
  description: string;
  visibleToPlayers: boolean;
  inventory: ShopItem[];
};

type ShopsState = {
  updatedAt: string;
  shops: Shop[];
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

function seedState(): ShopsState {
  return {
    updatedAt: new Date().toISOString(),
    shops: [
      {
        id: uid(),
        city: "Stonecross",
        name: "Stonecross General Wares",
        description: "A practical shop selling basics for travelers.",
        visibleToPlayers: true,
        inventory: [
          { id: uid(), name: "Rations (1 day)", qty: 20, priceGp: 0.5, notes: "" },
          { id: uid(), name: "Torch", qty: 30, priceGp: 0.01, notes: "" },
          { id: uid(), name: "Rope (50 ft)", qty: 8, priceGp: 1, notes: "" },
        ],
      },
    ],
  };
}

async function fetchShops(): Promise<ShopsState | null> {
  const res = await fetch(`/api/shops?room=${encodeURIComponent(ROOM)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: ShopsState | null };
  return json.data ?? null;
}

async function saveShops(next: ShopsState): Promise<boolean> {
  const res = await fetch(`/api/shops?room=${encodeURIComponent(ROOM)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
  return res.ok;
}

export default function ShopsPage() {
  const [sessionUsername, setSessionUsername] = useState<string | null>(null);
  const [state, setState] = useState<ShopsState>(() => seedState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CITIES.map((c) => [c, true]))
  );

  const isDM = useMemo(() => sessionUsername === DM_USERNAME, [sessionUsername]);

  useEffect(() => {
    setSessionUsername(loadSessionUsername());
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      const remote = await fetchShops();
      if (!mounted) return;

      if (remote && Array.isArray(remote.shops)) {
        setState(remote);
      }
      setLoading(false);
    })().catch(() => {
      if (!mounted) return;
      setError("Failed to load shops.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleShops = useMemo(() => {
    const base = state.shops ?? [];
    const filtered = isDM ? base : base.filter((s) => s.visibleToPlayers);
    // keep stable ordering by city then name
    return [...filtered].sort((a, b) => {
      const ca = CITIES.indexOf(a.city);
      const cb = CITIES.indexOf(b.city);
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });
  }, [state.shops, isDM]);

  const shopsByCity = useMemo(() => {
    const m = new Map<CityName, Shop[]>();
    for (const c of CITIES) m.set(c, []);
    for (const s of visibleShops) m.get(s.city)?.push(s);
    return m;
  }, [visibleShops]);

  function updateShop(id: string, patch: Partial<Shop>) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function addShop(city: CityName) {
    const next: Shop = {
      id: uid(),
      city,
      name: "New Shop",
      description: "",
      visibleToPlayers: false,
      inventory: [],
    };
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: [next, ...prev.shops],
    }));
  }

  function removeShop(id: string) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.filter((s) => s.id !== id),
    }));
  }

  function addItem(shopId: string) {
    const item: ShopItem = { id: uid(), name: "New Item", qty: 1, priceGp: 0, notes: "" };
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.map((s) =>
        s.id === shopId ? { ...s, inventory: [item, ...(s.inventory || [])] } : s
      ),
    }));
  }

  function updateItem(shopId: string, itemId: string, patch: Partial<ShopItem>) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.map((s) =>
        s.id === shopId
          ? {
              ...s,
              inventory: (s.inventory || []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
            }
          : s
      ),
    }));
  }

  function removeItem(shopId: string, itemId: string) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.map((s) =>
        s.id === shopId ? { ...s, inventory: (s.inventory || []).filter((it) => it.id !== itemId) } : s
      ),
    }));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    const ok = await saveShops({ ...state, updatedAt: new Date().toISOString() });
    setSaving(false);
    if (!ok) setError("Save failed. (Is KV configured in Vercel env vars?)");
  }

  function toggleCity(city: CityName) {
    setExpandedCities((prev) => ({ ...prev, [city]: !prev[city] }));
  }

  const container: React.CSSProperties = { maxWidth: 1100, margin: "0 auto" };
  const button: React.CSSProperties = {
    padding: "0.6rem 0.8rem",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.7rem",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
  };
  const label: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginBottom: 6 };
  const card: React.CSSProperties = {
    border: "1px solid #222",
    borderRadius: 12,
    padding: "1rem",
    background: "#0b0b0b",
  };

  return (
    <div style={container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Shops</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {loading ? "Loading..." : `Last updated: ${new Date(state.updatedAt).toLocaleString()}`}
          </div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {isDM ? "DM Mode: editing enabled (toggle what players can see)" : "Player Mode: visible shops only"}
          </div>
        </div>

        {isDM ? (
          <button style={button} onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #331", borderRadius: 10 }}>{error}</div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: "1rem" }}>
        {CITIES.map((city) => {
          const shops = shopsByCity.get(city) || [];
          const expanded = !!expandedCities[city];

          return (
            <div key={city} style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  padding: "0.9rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#0f0f0f",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <button style={button} onClick={() => toggleCity(city)}>
                    {expanded ? "−" : "+"}
                  </button>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{city}</div>
                  <div style={{ opacity: 0.7 }}>({shops.length})</div>
                </div>

                {isDM ? (
                  <button style={button} onClick={() => addShop(city)} disabled={saving}>
                    + Add Shop
                  </button>
                ) : null}
              </div>

              {expanded ? (
                <div style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
                  {shops.length === 0 ? <div style={{ opacity: 0.8 }}>No shops here yet.</div> : null}

                  {shops.map((s) => (
                    <div key={s.id} style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{s.name || "Unnamed Shop"}</div>
                        {isDM ? (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button style={button} onClick={() => addItem(s.id)} disabled={saving}>
                              + Item
                            </button>
                            <button style={button} onClick={() => removeShop(s.id)} disabled={saving}>
                              Remove Shop
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 220px", gap: "0.75rem" }}>
                        <div>
                          <div style={label}>Shop Name</div>
                          {isDM ? (
                            <input style={input} value={s.name} onChange={(e) => updateShop(s.id, { name: e.target.value })} />
                          ) : (
                            <div>{s.name || "—"}</div>
                          )}
                        </div>

                        <div>
                          <div style={label}>Visible to Players</div>
                          {isDM ? (
                            <label style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <input
                                type="checkbox"
                                checked={!!s.visibleToPlayers}
                                onChange={(e) => updateShop(s.id, { visibleToPlayers: e.target.checked })}
                              />
                              <span style={{ opacity: 0.85 }}>{s.visibleToPlayers ? "Visible" : "Hidden"}</span>
                            </label>
                          ) : (
                            <div>{s.visibleToPlayers ? "Visible" : "Hidden"}</div>
                          )}
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={label}>Description</div>
                          {isDM ? (
                            <textarea
                              style={{ ...input, minHeight: 70 }}
                              value={s.description}
                              onChange={(e) => updateShop(s.id, { description: e.target.value })}
                            />
                          ) : (
                            <div style={{ whiteSpace: "pre-wrap" }}>{s.description || "—"}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, opacity: 0.9 }}>Inventory</div>

                        {(s.inventory || []).length === 0 ? (
                          <div style={{ opacity: 0.8 }}>No items yet.</div>
                        ) : (
                          <div style={{ display: "grid", gap: "0.75rem" }}>
                            {(s.inventory || []).map((it) => (
                              <div
                                key={it.id}
                                style={{
                                  border: "1px solid #222",
                                  borderRadius: 12,
                                  padding: "0.75rem",
                                  background: "#0d0d0d",
                                }}
                              >
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 120px 140px",
                                    gap: "0.75rem",
                                    alignItems: "end",
                                  }}
                                >
                                  <div>
                                    <div style={label}>Item</div>
                                    {isDM ? (
                                      <input
                                        style={input}
                                        value={it.name}
                                        onChange={(e) => updateItem(s.id, it.id, { name: e.target.value })}
                                      />
                                    ) : (
                                      <div>{it.name || "—"}</div>
                                    )}
                                  </div>

                                  <div>
                                    <div style={label}>Qty</div>
                                    {isDM ? (
                                      <input
                                        style={input}
                                        type="number"
                                        value={Number.isFinite(it.qty) ? it.qty : 0}
                                        onChange={(e) => updateItem(s.id, it.id, { qty: Number(e.target.value) })}
                                      />
                                    ) : (
                                      <div>{it.qty}</div>
                                    )}
                                  </div>

                                  <div>
                                    <div style={label}>Price (gp)</div>
                                    {isDM ? (
                                      <input
                                        style={input}
                                        type="number"
                                        step="0.01"
                                        value={Number.isFinite(it.priceGp) ? it.priceGp : 0}
                                        onChange={(e) => updateItem(s.id, it.id, { priceGp: Number(e.target.value) })}
                                      />
                                    ) : (
                                      <div>{it.priceGp} gp</div>
                                    )}
                                  </div>

                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <div style={label}>Notes</div>
                                    {isDM ? (
                                      <textarea
                                        style={{ ...input, minHeight: 60 }}
                                        value={it.notes}
                                        onChange={(e) => updateItem(s.id, it.id, { notes: e.target.value })}
                                      />
                                    ) : (
                                      <div style={{ whiteSpace: "pre-wrap" }}>{it.notes || "—"}</div>
                                    )}
                                  </div>

                                  {isDM ? (
                                    <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                                      <button style={button} onClick={() => removeItem(s.id, it.id)} disabled={saving}>
                                        Remove Item
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
