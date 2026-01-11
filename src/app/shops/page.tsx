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

function formatGp(n: number) {
  if (!Number.isFinite(n)) return "0 gp";
  const s = n.toFixed(2).replace(/\.?0+$/, "");
  return `${s} gp`;
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
  const [expandedShops, setExpandedShops] = useState<Record<string, boolean>>({});

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
      if (remote && Array.isArray(remote.shops)) setState(remote);
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

 
  useEffect(() => {
    setExpandedShops((prev) => {
      const next = { ...prev };
      for (const s of visibleShops) {
        if (next[s.id] === undefined) next[s.id] = false; 
      }
      
      for (const key of Object.keys(next)) {
        if (!visibleShops.some((s) => s.id === key)) delete next[key];
      }
      return next;
    });
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
    setExpandedShops((prev) => ({ ...prev, [next.id]: true }));
  }

  function removeShop(id: string) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.filter((s) => s.id !== id),
    }));
    setExpandedShops((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addItem(shopId: string) {
    const item: ShopItem = { id: uid(), name: "New Item", qty: 1, priceGp: 0, notes: "" };
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.map((s) => (s.id === shopId ? { ...s, inventory: [item, ...(s.inventory || [])] } : s)),
    }));
    setExpandedShops((prev) => ({ ...prev, [shopId]: true }));
  }

  function updateItem(shopId: string, itemId: string, patch: Partial<ShopItem>) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      shops: prev.shops.map((s) =>
        s.id === shopId
          ? { ...s, inventory: (s.inventory || []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
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

  function toggleShop(shopId: string) {
    setExpandedShops((prev) => ({ ...prev, [shopId]: !prev[shopId] }));
  }

  // --- styles ---
  const wrap: React.CSSProperties = { maxWidth: 1050, margin: "0 auto" };

  const headerRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
  };

  const button: React.CSSProperties = {
    padding: "0.55rem 0.75rem",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  };

  const ghostButton: React.CSSProperties = {
    padding: "0.45rem 0.65rem",
    borderRadius: 10,
    border: "1px solid #222",
    background: "rgba(255,255,255,0.03)",
    color: "#fff",
    cursor: "pointer",
  };

  const pill: React.CSSProperties = {
    padding: "0.2rem 0.55rem",
    borderRadius: 999,
    border: "1px solid #2a2a2a",
    background: "#111",
    opacity: 0.9,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.65rem",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
  };

  const label: React.CSSProperties = { fontSize: 12, opacity: 0.75, marginBottom: 6 };

  const cityBlock: React.CSSProperties = {
    border: "1px solid #222",
    borderRadius: 14,
    overflow: "hidden",
    background: "#0b0b0b",
  };

  const cityHeader: React.CSSProperties = {
    padding: "0.9rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0f0f0f",
    borderBottom: "1px solid #1d1d1d",
  };

  const shopShell: React.CSSProperties = {
    border: "1px solid #1f1f1f",
    borderRadius: 14,
    background: "#0d0d0d",
    overflow: "hidden",
  };

  const shopHeader: React.CSSProperties = {
    padding: "0.9rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    background: "rgba(255,255,255,0.02)",
    borderBottom: "1px solid #151515",
  };

  const shopBody: React.CSSProperties = {
    padding: "1rem",
  };

  const table: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 10,
    fontSize: 14,
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "0.55rem 0.5rem",
    borderBottom: "1px solid #222",
    opacity: 0.8,
    fontSize: 12,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  };

  const td: React.CSSProperties = {
    padding: "0.55rem 0.5rem",
    borderBottom: "1px solid #141414",
    verticalAlign: "top",
  };

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div>
          <h1 style={{ margin: 0 }}>Shops</h1>
          {isDM ? (
            <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
              {loading ? "Loading..." : `Last updated: ${new Date(state.updatedAt).toLocaleString()}`}
            </div>
          ) : null}
        </div>

        {isDM ? (
          <button style={button} onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: 12, border: "1px solid #331", borderRadius: 12 }}>{error}</div>
      ) : null}

      {loading ? <div style={{ opacity: 0.8 }}>Loading shops…</div> : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        {CITIES.map((city) => {
          const shops = shopsByCity.get(city) || [];
          const expandedCity = !!expandedCities[city];

          if (!isDM && shops.length === 0) return null;

          return (
            <div key={city} style={cityBlock}>
              <div style={cityHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <button style={ghostButton} onClick={() => toggleCity(city)}>
                    {expandedCity ? "▾" : "▸"}
                  </button>

                  <div style={{ fontSize: 18, fontWeight: 800 }}>{city}</div>
                  <div style={pill}>
                    {shops.length} shop{shops.length === 1 ? "" : "s"}
                  </div>
                </div>

                {isDM ? (
                  <button style={button} onClick={() => addShop(city)} disabled={saving}>
                    + Add Shop
                  </button>
                ) : null}
              </div>

              {expandedCity ? (
                <div style={{ padding: "1rem", display: "grid", gap: "0.85rem" }}>
                  {shops.length === 0 ? <div style={{ opacity: 0.8 }}>No shops here yet.</div> : null}

                  {shops.map((s) => {
                    const expandedShop = !!expandedShops[s.id];

                    return (
                      <div key={s.id} style={shopShell}>
                        {/* Shop dropdown header */}
                        <div style={shopHeader}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                            <button style={ghostButton} onClick={() => toggleShop(s.id)}>
                              {expandedShop ? "▾" : "▸"}
                            </button>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>
                                {s.name || "Unnamed Shop"}
                              </div>
                              {s.description ? (
                                <div style={{ opacity: 0.7, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {s.description}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {isDM ? (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={!!s.visibleToPlayers}
                                  onChange={(e) => updateShop(s.id, { visibleToPlayers: e.target.checked })}
                                />
                                <span style={{ opacity: 0.85, fontSize: 13 }}>Visible</span>
                              </label>

                              <button style={button} onClick={() => addItem(s.id)} disabled={saving}>
                                + Item
                              </button>
                              <button style={button} onClick={() => removeShop(s.id)} disabled={saving}>
                                Remove
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {/* Shop body */}
                        {expandedShop ? (
                          <div style={shopBody}>
                            {s.description ? (
                              <div style={{ opacity: 0.8, whiteSpace: "pre-wrap", marginBottom: 10 }}>{s.description}</div>
                            ) : null}

                            {/* DM edit fields */}
                            {isDM ? (
                              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 220px", gap: "0.75rem" }}>
                                <div>
                                  <div style={label}>Shop Name</div>
                                  <input
                                    style={input}
                                    value={s.name}
                                    onChange={(e) => updateShop(s.id, { name: e.target.value })}
                                  />
                                </div>

                                <div>
                                  <div style={label}>City</div>
                                  <select
                                    style={input}
                                    value={s.city}
                                    onChange={(e) => updateShop(s.id, { city: e.target.value as CityName })}
                                  >
                                    {CITIES.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div style={{ gridColumn: "1 / -1" }}>
                                  <div style={label}>Description</div>
                                  <textarea
                                    style={{ ...input, minHeight: 70 }}
                                    value={s.description}
                                    onChange={(e) => updateShop(s.id, { description: e.target.value })}
                                  />
                                </div>
                              </div>
                            ) : null}

                            {/* Inventory */}
                            {(s.inventory || []).length > 0 ? (
                              <table style={table}>
                                <thead>
                                  <tr>
                                    <th style={th}>Item</th>
                                    <th style={{ ...th, width: 90 }}>Qty</th>
                                    <th style={{ ...th, width: 120 }}>Price</th>
                                    {isDM ? <th style={{ ...th, width: 120 }} /> : null}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(s.inventory || []).map((it) => (
                                    <tr key={it.id}>
                                      <td style={td}>
                                        {isDM ? (
                                          <>
                                            <input
                                              style={input}
                                              value={it.name}
                                              onChange={(e) => updateItem(s.id, it.id, { name: e.target.value })}
                                            />
                                            <div style={{ marginTop: 8 }}>
                                              <div style={label}>Notes</div>
                                              <textarea
                                                style={{ ...input, minHeight: 60 }}
                                                value={it.notes}
                                                onChange={(e) => updateItem(s.id, it.id, { notes: e.target.value })}
                                              />
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div style={{ fontWeight: 700 }}>{it.name || "—"}</div>
                                            {it.notes ? (
                                              <div style={{ opacity: 0.75, marginTop: 4, whiteSpace: "pre-wrap" }}>{it.notes}</div>
                                            ) : null}
                                          </>
                                        )}
                                      </td>

                                      <td style={td}>
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
                                      </td>

                                      <td style={td}>
                                        {isDM ? (
                                          <input
                                            style={input}
                                            type="number"
                                            step="0.01"
                                            value={Number.isFinite(it.priceGp) ? it.priceGp : 0}
                                            onChange={(e) => updateItem(s.id, it.id, { priceGp: Number(e.target.value) })}
                                          />
                                        ) : (
                                          <div>{formatGp(it.priceGp)}</div>
                                        )}
                                      </td>

                                      {isDM ? (
                                        <td style={td}>
                                          <button style={button} onClick={() => removeItem(s.id, it.id)} disabled={saving}>
                                            Remove
                                          </button>
                                        </td>
                                      ) : null}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ marginTop: 10, opacity: 0.75 }}>
                                {isDM ? "No items yet. Click “+ Item” to add inventory." : "No inventory listed."}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
