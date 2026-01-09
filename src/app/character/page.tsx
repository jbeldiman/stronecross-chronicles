"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import spellsData from "../../data/spells.json";
import traitsData from "../../data/traits.json";

const AUTH_SESSION_KEY = "stonecross.session.v1";

type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

type SkillKey =
  | "Acrobatics"
  | "Animal Handling"
  | "Arcana"
  | "Athletics"
  | "Deception"
  | "History"
  | "Insight"
  | "Intimidation"
  | "Investigation"
  | "Medicine"
  | "Nature"
  | "Perception"
  | "Performance"
  | "Persuasion"
  | "Religion"
  | "Sleight of Hand"
  | "Stealth"
  | "Survival";

type TraitEntry = {
  id: string;
  sourceBook: string;
  background: string;
  type: "Personality Trait" | "Ideal" | "Bond" | "Flaw";
  text: string;
};

const TRAITS = traitsData as TraitEntry[];

const SKILLS: { key: SkillKey; ability: Ability }[] = [
  { key: "Acrobatics", ability: "DEX" },
  { key: "Animal Handling", ability: "WIS" },
  { key: "Arcana", ability: "INT" },
  { key: "Athletics", ability: "STR" },
  { key: "Deception", ability: "CHA" },
  { key: "History", ability: "INT" },
  { key: "Insight", ability: "WIS" },
  { key: "Intimidation", ability: "CHA" },
  { key: "Investigation", ability: "INT" },
  { key: "Medicine", ability: "WIS" },
  { key: "Nature", ability: "INT" },
  { key: "Perception", ability: "WIS" },
  { key: "Performance", ability: "CHA" },
  { key: "Persuasion", ability: "CHA" },
  { key: "Religion", ability: "INT" },
  { key: "Sleight of Hand", ability: "DEX" },
  { key: "Stealth", ability: "DEX" },
  { key: "Survival", ability: "WIS" },
];

type Weapon = {
  name: string;
  toHitBonus: number;
  damageBonus: number;
  magicalEffects: string;
};

type Armor = {
  name: string;
  acBonus: number;
  dexCap: number | null;
  notes: string;
};

type Spell = {
  id: string;
  name: string;
  level: number;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  description: string;
};

const SPELLS = spellsData as Spell[];

type CharacterSheet = {
  name: string;
  className: string;
  level: number;

  experience: number;

  abilities: Record<Ability, number>;
  savingThrowProficiencies: Partial<Record<Ability, boolean>>;
  skillProficiencies: Partial<Record<SkillKey, boolean>>;
  skillExpertise: Partial<Record<SkillKey, boolean>>;

  maxHp: number;
  currentHp: number;
  tempHp: number;

  baseAc: number;
  initiativeBonus: number;
  speed: number;

  inventory: string[];

  weapons: Weapon[];
  armor: Armor | null;

  background: string;
  personalityTrait: string;
  ideal: string;
  bond: string;
  flaw: string;

  traits: string[];

  cantripIds: string[];
  spellIdsByLevel: Record<number, string[]>;
  spellSlotsMax: Record<number, number>;
  spellSlotsUsed: Record<number, number>;
};

type Session = {
  username: string;
  loggedInAt?: string;
};

const XP_FOR_LEVEL: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2);
}

function fmtSigned(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function profBonusForLevel(level: number) {
  const l = clamp(level, 1, 20);
  if (l >= 17) return 6;
  if (l >= 13) return 5;
  if (l >= 9) return 4;
  if (l >= 5) return 3;
  return 2;
}

function nextLevelXp(level: number) {
  const l = clamp(level, 1, 20);
  if (l >= 20) return null;
  return XP_FOR_LEVEL[l + 1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultSheet(): CharacterSheet {
  return {
    name: "Unnamed Hero",
    className: "Fighter",
    level: 1,

    experience: 0,

    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    savingThrowProficiencies: {},
    skillProficiencies: {},
    skillExpertise: {},

    maxHp: 10,
    currentHp: 10,
    tempHp: 0,

    baseAc: 10,
    initiativeBonus: 0,
    speed: 30,

    inventory: ["Rations", "Torch", "Rope (50 ft)"],

    weapons: [{ name: "Longsword", toHitBonus: 0, damageBonus: 0, magicalEffects: "" }],
    armor: { name: "Leather Armor", acBonus: 0, dexCap: null, notes: "" },

    background: "",
    personalityTrait: "",
    ideal: "",
    bond: "",
    flaw: "",

    traits: ["Darkvision"],

    cantripIds: [],
    spellIdsByLevel: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] },
    spellSlotsMax: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    spellSlotsUsed: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
  };
}

function normalizeSheet(raw: unknown): CharacterSheet {
  const base = defaultSheet();
  const r = isRecord(raw) ? raw : {};

  const merged: CharacterSheet = {
    ...base,
    ...r,

    name: typeof r.name === "string" ? r.name : base.name,
    className: typeof r.className === "string" ? r.className : base.className,

    level: clamp(Number(r.level ?? base.level), 1, 20),
    experience: clamp(Number(r.experience ?? base.experience), 0, XP_FOR_LEVEL[20]),

    abilities: {
      ...base.abilities,
      ...(isRecord(r.abilities) ? (r.abilities as Record<string, unknown>) : {}),
    } as CharacterSheet["abilities"],

    savingThrowProficiencies: (isRecord(r.savingThrowProficiencies)
      ? (r.savingThrowProficiencies as Record<string, unknown>)
      : {}) as CharacterSheet["savingThrowProficiencies"],

    skillProficiencies: (isRecord(r.skillProficiencies)
      ? (r.skillProficiencies as Record<string, unknown>)
      : {}) as CharacterSheet["skillProficiencies"],

    skillExpertise: (isRecord(r.skillExpertise) ? (r.skillExpertise as Record<string, unknown>) : {}) as CharacterSheet["skillExpertise"],

    maxHp: Number.isFinite(Number(r.maxHp)) ? clamp(Number(r.maxHp), 1, 999) : base.maxHp,
    currentHp: Number.isFinite(Number(r.currentHp)) ? clamp(Number(r.currentHp), 0, 999) : base.currentHp,
    tempHp: Number.isFinite(Number(r.tempHp)) ? clamp(Number(r.tempHp), 0, 999) : base.tempHp,

    baseAc: Number.isFinite(Number(r.baseAc)) ? clamp(Number(r.baseAc), 0, 50) : base.baseAc,
    initiativeBonus: Number.isFinite(Number(r.initiativeBonus)) ? clamp(Number(r.initiativeBonus), -20, 20) : base.initiativeBonus,
    speed: Number.isFinite(Number(r.speed)) ? clamp(Number(r.speed), 0, 200) : base.speed,

    inventory: Array.isArray(r.inventory) ? r.inventory.filter((x): x is string => typeof x === "string") : base.inventory,

    weapons: Array.isArray(r.weapons)
      ? r.weapons
          .filter(isRecord)
          .map((w) => ({
            name: typeof w.name === "string" ? w.name : "Weapon",
            toHitBonus: Number.isFinite(Number(w.toHitBonus)) ? Number(w.toHitBonus) : 0,
            damageBonus: Number.isFinite(Number(w.damageBonus)) ? Number(w.damageBonus) : 0,
            magicalEffects: typeof w.magicalEffects === "string" ? w.magicalEffects : "",
          }))
      : base.weapons,

    armor: isRecord(r.armor)
      ? {
          name: typeof (r.armor as Record<string, unknown>).name === "string" ? String((r.armor as Record<string, unknown>).name) : "Armor",
          acBonus: Number.isFinite(Number((r.armor as Record<string, unknown>).acBonus)) ? Number((r.armor as Record<string, unknown>).acBonus) : 0,
          dexCap:
            (r.armor as Record<string, unknown>).dexCap === null
              ? null
              : Number.isFinite(Number((r.armor as Record<string, unknown>).dexCap))
                ? Number((r.armor as Record<string, unknown>).dexCap)
                : null,
          notes: typeof (r.armor as Record<string, unknown>).notes === "string" ? String((r.armor as Record<string, unknown>).notes) : "",
        }
      : r.armor === null
        ? null
        : base.armor,

    background: typeof r.background === "string" ? r.background : base.background,
    personalityTrait: typeof r.personalityTrait === "string" ? r.personalityTrait : base.personalityTrait,
    ideal: typeof r.ideal === "string" ? r.ideal : base.ideal,
    bond: typeof r.bond === "string" ? r.bond : base.bond,
    flaw: typeof r.flaw === "string" ? r.flaw : base.flaw,

    traits: Array.isArray(r.traits) ? r.traits.filter((x): x is string => typeof x === "string") : base.traits,

    cantripIds: Array.isArray(r.cantripIds) ? r.cantripIds.filter((x): x is string => typeof x === "string") : base.cantripIds,

    spellIdsByLevel: {
      ...base.spellIdsByLevel,
      ...(isRecord(r.spellIdsByLevel) ? (r.spellIdsByLevel as Record<string, unknown>) : {}),
    } as CharacterSheet["spellIdsByLevel"],

    spellSlotsMax: {
      ...base.spellSlotsMax,
      ...(isRecord(r.spellSlotsMax) ? (r.spellSlotsMax as Record<string, unknown>) : {}),
    } as CharacterSheet["spellSlotsMax"],

    spellSlotsUsed: {
      ...base.spellSlotsUsed,
      ...(isRecord(r.spellSlotsUsed) ? (r.spellSlotsUsed as Record<string, unknown>) : {}),
    } as CharacterSheet["spellSlotsUsed"],
  };

  merged.name = merged.name || base.name;
  merged.className = merged.className || base.className;

  const cleanedExpertise: Partial<Record<SkillKey, boolean>> = { ...(merged.skillExpertise ?? {}) };
  for (const sk of SKILLS) {
    if (!merged.skillProficiencies[sk.key] && cleanedExpertise[sk.key]) cleanedExpertise[sk.key] = false;
  }
  merged.skillExpertise = cleanedExpertise;

  return merged;
}

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

function normalizeUsername(v: string) {
  return (v || "").trim().toLowerCase();
}

async function fetchCharacter(actor: string): Promise<CharacterSheet | null> {
  const res = await fetch(`/api/character?username=${encodeURIComponent(actor)}`, {
    headers: { "x-sc-user": actor },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { sheet?: unknown };
  return json?.sheet ? normalizeSheet(json.sheet) : null;
}

async function saveCharacter(actor: string, sheet: CharacterSheet): Promise<boolean> {
  const res = await fetch(`/api/character`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sc-user": actor,
    },
    body: JSON.stringify({ sheet }),
  });
  return res.ok;
}

export default function CharacterPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [sheet, setSheet] = useState<CharacterSheet>(() => defaultSheet());
  const [selectedSpellId, setSelectedSpellId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const loadedFromKvRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login?next=/character");
      return;
    }
    setSession({ ...s, username: normalizeUsername(s.username) });
  }, [router]);

  useEffect(() => {
    if (!session?.username) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const loaded = await fetchCharacter(session.username);
        if (cancelled) return;
        setSheet(loaded ?? defaultSheet());
      } finally {
        if (!cancelled) {
          loadedFromKvRef.current = true;
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.username]);

  useEffect(() => {
    if (!session?.username) return;
    if (!loadedFromKvRef.current) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const ok = await saveCharacter(session.username, sheet);
        setSaveState(ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [sheet, session?.username]);

  const spellsById = useMemo(() => {
    const m = new Map<string, Spell>();
    for (const s of SPELLS) m.set(s.id, s);
    return m;
  }, []);

  const cantrips = useMemo(() => SPELLS.filter((s) => s.level === 0), []);
  const leveledSpells = useMemo(() => SPELLS.filter((s) => s.level > 0), []);

  const proficiencyBonus = profBonusForLevel(sheet.level);
  const nextXp = nextLevelXp(sheet.level);
  const xpToNext = nextXp === null ? 0 : Math.max(0, nextXp - sheet.experience);

  const dexMod = abilityMod(sheet.abilities.DEX);

  const dexContribution = useMemo(() => {
    if (!sheet.armor) return dexMod;
    const cap = sheet.armor.dexCap;
    if (cap === null || !Number.isFinite(Number(cap))) return dexMod;
    return Math.min(dexMod, Number(cap));
  }, [sheet.armor, dexMod]);

  const calculatedAc = useMemo(() => {
    const base = Number.isFinite(Number(sheet.baseAc)) ? Number(sheet.baseAc) : 10;
    const armorBonus = sheet.armor ? (Number.isFinite(Number(sheet.armor.acBonus)) ? Number(sheet.armor.acBonus) : 0) : 0;
    return base + armorBonus + dexContribution;
  }, [sheet.baseAc, sheet.armor, dexContribution]);

  const selectedSpell = selectedSpellId ? spellsById.get(selectedSpellId) : undefined;

  const BACKGROUNDS = useMemo(() => Array.from(new Set(TRAITS.map((t) => t.background))).sort(), []);

  function update<K extends keyof CharacterSheet>(key: K, value: CharacterSheet[K]) {
    setSheet((prev) => ({ ...prev, [key]: value }));
  }

  function patch(partial: Partial<CharacterSheet>) {
    setSheet((prev) => ({ ...prev, ...partial }));
  }

  function ensureSpellExists(id: string) {
    return spellsById.has(id);
  }

  const safeCantripIds = useMemo(() => sheet.cantripIds.filter(ensureSpellExists), [sheet.cantripIds, spellsById]);

  const safeSpellIdsByLevel: CharacterSheet["spellIdsByLevel"] = useMemo(() => {
    const next: CharacterSheet["spellIdsByLevel"] = { ...sheet.spellIdsByLevel };
    for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      next[lvl] = (sheet.spellIdsByLevel[lvl] ?? []).filter(ensureSpellExists);
    }
    return next;
  }, [sheet.spellIdsByLevel, spellsById]);

  function isSkillProficient(k: SkillKey) {
    return !!sheet.skillProficiencies[k];
  }

  function isSkillExpert(k: SkillKey) {
    return !!sheet.skillExpertise[k] && !!sheet.skillProficiencies[k];
  }

  function skillTotal(k: SkillKey, ability: Ability) {
    const mod = abilityMod(sheet.abilities[ability]);
    const mult = isSkillExpert(k) ? 2 : isSkillProficient(k) ? 1 : 0;
    return mod + proficiencyBonus * mult;
  }

  if (!session) {
    return (
      <main className="sc-page">
        <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/character.jpg')" }} />
        <div className="sc-overlay" />
        <div className="sc-content" style={{ padding: "2rem" }}>
          <h1 style={{ marginBottom: "0.5rem" }}>Character Sheet</h1>
          <section style={cardStyle}>
            <p style={{ opacity: 0.85 }}>Loading…</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="sc-page">
      <div className="sc-bg" style={{ backgroundImage: "url('/backgrounds/character.jpg')" }} />
      <div className="sc-overlay" />
      <div className="sc-content" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ marginBottom: "0.5rem" }}>Character Sheet</h1>
            <div style={{ opacity: 0.75, fontSize: "0.95rem" }}>
              Logged in as <strong>{session.username}</strong>{" "}
              {loading ? (
                <span style={{ opacity: 0.75 }}>• Loading…</span>
              ) : (
                <span style={{ opacity: 0.75 }}>
                  •{" "}
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Save failed"
                        : ""}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                localStorage.removeItem(AUTH_SESSION_KEY);
                router.replace("/");
              }}
              style={{ ...btnStyle, background: "rgba(255,255,255,0.06)" }}
              title="Log out"
            >
              Log out
            </button>
          </div>
        </div>

        <section style={cardStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 120px 160px 200px",
              gap: "1rem",
            }}
          >
            <Field label="Name">
              <input value={sheet.name} onChange={(e) => update("name", e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Class">
              <input value={sheet.className} onChange={(e) => update("className", e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Level">
              <input
                type="number"
                value={sheet.level}
                onChange={(e) => update("level", clamp(Number(e.target.value), 1, 20))}
                style={inputStyle}
              />
            </Field>

            <Field label="Experience">
              <input
                type="number"
                value={sheet.experience}
                onChange={(e) => update("experience", clamp(Number(e.target.value), 0, XP_FOR_LEVEL[20]))}
                style={inputStyle}
              />
            </Field>

            <Field label="XP to Next Level">
              <input value={nextXp === null ? "—" : String(xpToNext)} readOnly style={{ ...inputStyle, opacity: 0.9 }} />
            </Field>
          </div>

          <div style={{ marginTop: "0.75rem", opacity: 0.9 }}>
            Proficiency Bonus: <strong>{fmtSigned(proficiencyBonus)}</strong>
            {nextXp !== null ? (
              <>
                {" "}
                • Next level at <strong>{nextXp}</strong> XP
              </>
            ) : (
              <>
                {" "}
                • <strong>Max level</strong>
              </>
            )}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1rem", marginTop: "1rem" }}>
          <section style={cardStyle}>
            <h2 style={h2}>Abilities</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as Ability[]).map((ab) => {
                const score = sheet.abilities[ab];
                const mod = abilityMod(score);

                return (
                  <div key={ab} style={miniCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{ab}</strong>
                      <span style={{ opacity: 0.9 }}>{fmtSigned(mod)}</span>
                    </div>

                    <input
                      type="number"
                      value={score}
                      onChange={(e) =>
                        update("abilities", {
                          ...sheet.abilities,
                          [ab]: clamp(Number(e.target.value), 1, 30),
                        })
                      }
                      style={inputStyle}
                    />

                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.35rem" }}>
                      <input
                        type="checkbox"
                        checked={!!sheet.savingThrowProficiencies[ab]}
                        onChange={(e) =>
                          update("savingThrowProficiencies", {
                            ...sheet.savingThrowProficiencies,
                            [ab]: e.target.checked,
                          })
                        }
                      />
                      <span style={{ fontSize: "0.9rem", opacity: 0.9 }}>Saving throw prof.</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={h2}>Combat</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
              <Stat label="AC" value={calculatedAc} />
              <Stat label="Initiative" value={fmtSigned(sheet.initiativeBonus + dexMod)} />
              <Stat label="Speed" value={`${sheet.speed} ft`} />
              <Stat label="HP" value={`${sheet.currentHp}/${sheet.maxHp} (+${sheet.tempHp} temp)`} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
              <Field label="Max HP">
                <input
                  type="number"
                  value={sheet.maxHp}
                  onChange={(e) => update("maxHp", clamp(Number(e.target.value), 1, 999))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Current HP">
                <input
                  type="number"
                  value={sheet.currentHp}
                  onChange={(e) => update("currentHp", clamp(Number(e.target.value), 0, 999))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Temp HP">
                <input
                  type="number"
                  value={sheet.tempHp}
                  onChange={(e) => update("tempHp", clamp(Number(e.target.value), 0, 999))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
              <Field label="AC Base">
                <input
                  type="number"
                  value={sheet.baseAc}
                  onChange={(e) => update("baseAc", clamp(Number(e.target.value), 0, 50))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Initiative Bonus">
                <input
                  type="number"
                  value={sheet.initiativeBonus}
                  onChange={(e) => update("initiativeBonus", clamp(Number(e.target.value), -20, 20))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Speed (ft)">
                <input
                  type="number"
                  value={sheet.speed}
                  onChange={(e) => update("speed", clamp(Number(e.target.value), 0, 200))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <p style={{ marginTop: "0.75rem", opacity: 0.9 }}>
              Calculated AC: <strong>{calculatedAc}</strong> <span style={{ opacity: 0.8 }}>(base + armor bonus + dex contribution)</span>
            </p>
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <section style={cardStyle}>
            <h2 style={h2}>Skills</h2>

            <div style={{ opacity: 0.8, fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Proficient adds PB. Expertise adds <strong>2×</strong> PB (and requires proficiency).
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {SKILLS.map((s) => {
                const total = skillTotal(s.key, s.ability);
                const prof = isSkillProficient(s.key);
                const exp = isSkillExpert(s.key);

                return (
                  <div
                    key={s.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "0.5rem",
                      padding: "0.5rem 0.6rem",
                      border: "1px solid #222",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                        <input
                          type="checkbox"
                          checked={prof}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const nextProf = { ...sheet.skillProficiencies, [s.key]: checked };
                            const nextExp = { ...sheet.skillExpertise };
                            if (!checked) nextExp[s.key] = false;
                            patch({ skillProficiencies: nextProf, skillExpertise: nextExp });
                          }}
                        />
                        <span>
                          {s.key} <span style={{ opacity: 0.7 }}>({s.ability})</span>
                        </span>
                      </label>

                      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", opacity: prof ? 1 : 0.45 }}>
                        <input
                          type="checkbox"
                          checked={exp}
                          disabled={!prof}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            patch({ skillExpertise: { ...sheet.skillExpertise, [s.key]: checked } });
                          }}
                        />
                        <span style={{ fontSize: "0.9rem" }}>Expertise</span>
                      </label>
                    </div>

                    <strong style={{ alignSelf: "center" }}>{fmtSigned(total)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={h2}>Inventory</h2>
            <ul style={{ marginLeft: "1rem" }}>
              {sheet.inventory.map((it, idx) => (
                <li key={idx} style={{ margin: "0.25rem 0" }}>
                  {it}{" "}
                  <button onClick={() => update("inventory", sheet.inventory.filter((_, i) => i !== idx))} style={linkBtnStyle}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
            <AddRow placeholder="Add an item (e.g., Healing Potion)" onAdd={(v) => update("inventory", [...sheet.inventory, v])} />
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <section style={cardStyle}>
            <h2 style={h2}>Weapons</h2>
            {sheet.weapons.map((w, idx) => (
              <div key={idx} style={miniCardStyle}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 110px 1fr",
                    gap: "0.75rem",
                    alignItems: "end",
                  }}
                >
                  <Field label="Name">
                    <input
                      value={w.name}
                      onChange={(e) => {
                        const next = [...sheet.weapons];
                        next[idx] = { ...w, name: e.target.value };
                        update("weapons", next);
                      }}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="+ To Hit">
                    <input
                      type="number"
                      value={w.toHitBonus}
                      onChange={(e) => {
                        const next = [...sheet.weapons];
                        next[idx] = { ...w, toHitBonus: Number(e.target.value) };
                        update("weapons", next);
                      }}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="+ Damage">
                    <input
                      type="number"
                      value={w.damageBonus}
                      onChange={(e) => {
                        const next = [...sheet.weapons];
                        next[idx] = { ...w, damageBonus: Number(e.target.value) };
                        update("weapons", next);
                      }}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Magical Effects / Notes">
                    <textarea
                      value={w.magicalEffects}
                      onChange={(e) => {
                        const next = [...sheet.weapons];
                        next[idx] = { ...w, magicalEffects: e.target.value };
                        update("weapons", next);
                      }}
                      style={{ ...inputStyle, minHeight: 44, resize: "vertical" }}
                    />
                  </Field>
                </div>

                <button onClick={() => update("weapons", sheet.weapons.filter((_, i) => i !== idx))} style={{ ...linkBtnStyle, marginTop: "0.5rem" }}>
                  remove weapon
                </button>
              </div>
            ))}

            <button
              onClick={() =>
                update("weapons", [...sheet.weapons, { name: "New Weapon", toHitBonus: 0, damageBonus: 0, magicalEffects: "" }])
              }
              style={btnStyle}
            >
              + Add Weapon
            </button>
          </section>

          <section style={cardStyle}>
            <h2 style={h2}>Armor</h2>

            {sheet.armor ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: "0.75rem" }}>
                  <Field label="Armor Name">
                    <input
                      value={sheet.armor.name}
                      onChange={(e) => update("armor", { ...sheet.armor!, name: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="+ AC">
                    <input
                      type="number"
                      value={sheet.armor.acBonus}
                      onChange={(e) => update("armor", { ...sheet.armor!, acBonus: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Dex Cap">
                    <input
                      type="number"
                      value={sheet.armor.dexCap ?? ""}
                      placeholder="none"
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        const cap = v === "" ? null : clamp(Number(v), -10, 20);
                        update("armor", { ...sheet.armor!, dexCap: Number.isFinite(Number(cap)) ? cap : null });
                      }}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label="Notes" style={{ marginTop: "0.75rem" }}>
                  <textarea
                    value={sheet.armor.notes}
                    onChange={(e) => update("armor", { ...sheet.armor!, notes: e.target.value })}
                    style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                  />
                </Field>

                <p style={{ marginTop: "0.75rem", opacity: 0.9 }}>
                  Calculated AC: <strong>{calculatedAc}</strong>
                </p>

                <button onClick={() => update("armor", null)} style={btnStyle}>
                  Remove Armor
                </button>
              </>
            ) : (
              <button onClick={() => update("armor", { name: "Armor", acBonus: 0, dexCap: null, notes: "" })} style={btnStyle}>
                + Add Armor
              </button>
            )}
          </section>
        </div>

        <section style={{ ...cardStyle, marginTop: "1rem" }}>
          <h2 style={h2}>Spellcasting</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div style={miniCardStyle}>
              <h3 style={h3}>Cantrips</h3>

              <SpellSearchAdd
                label="Search & add cantrip"
                options={cantrips}
                disabledIds={safeCantripIds}
                onAdd={(id) => update("cantripIds", [...safeCantripIds, id])}
              />

              <SelectedSpellList
                ids={safeCantripIds}
                spellsById={spellsById}
                onRemove={(id) => update("cantripIds", safeCantripIds.filter((x) => x !== id))}
                onInspect={(id) => setSelectedSpellId(id)}
              />
            </div>

            <div style={miniCardStyle}>
              <h3 style={h3}>Spell Description</h3>
              {selectedSpell ? (
                <div style={{ lineHeight: 1.35 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <strong>{selectedSpell.name}</strong>
                    <span style={{ opacity: 0.8 }}>{selectedSpell.level === 0 ? "Cantrip" : `Level ${selectedSpell.level}`}</span>
                  </div>

                  <div style={{ marginTop: "0.5rem", opacity: 0.9 }}>
                    {selectedSpell.school ? (
                      <div>
                        <strong>School:</strong> {selectedSpell.school}
                      </div>
                    ) : null}
                    {selectedSpell.castingTime ? (
                      <div>
                        <strong>Casting Time:</strong> {selectedSpell.castingTime}
                      </div>
                    ) : null}
                    {selectedSpell.range ? (
                      <div>
                        <strong>Range:</strong> {selectedSpell.range}
                      </div>
                    ) : null}
                    {selectedSpell.components ? (
                      <div>
                        <strong>Components:</strong> {selectedSpell.components}
                      </div>
                    ) : null}
                    {selectedSpell.duration ? (
                      <div>
                        <strong>Duration:</strong> {selectedSpell.duration}
                      </div>
                    ) : null}
                  </div>

                  <p style={{ marginTop: "0.75rem" }}>{selectedSpell.description}</p>
                </div>
              ) : (
                <p style={{ opacity: 0.8 }}>Click a selected spell/cantrip to view details here.</p>
              )}
            </div>

            <div style={miniCardStyle}>
              <h3 style={h3}>Background & Traits</h3>

              <Field label="Background">
                <select
                  value={sheet.background}
                  onChange={(e) => {
                    const b = e.target.value;
                    patch({ background: b, personalityTrait: "", ideal: "", bond: "", flaw: "" });
                  }}
                  style={inputStyle}
                >
                  <option value="">Select…</option>
                  {BACKGROUNDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>

              {sheet.background ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ marginTop: "0.75rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.25rem" }}>Personality Trait</strong>
                    <TraitPicker
                      entries={TRAITS.filter((t) => t.background === sheet.background && t.type === "Personality Trait")}
                      value={sheet.personalityTrait}
                      onPick={(v) => update("personalityTrait", v)}
                    />
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.25rem" }}>Ideal</strong>
                    <TraitPicker
                      entries={TRAITS.filter((t) => t.background === sheet.background && t.type === "Ideal")}
                      value={sheet.ideal}
                      onPick={(v) => update("ideal", v)}
                    />
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.25rem" }}>Bond</strong>
                    <TraitPicker
                      entries={TRAITS.filter((t) => t.background === sheet.background && t.type === "Bond")}
                      value={sheet.bond}
                      onPick={(v) => update("bond", v)}
                    />
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.25rem" }}>Flaw</strong>
                    <TraitPicker
                      entries={TRAITS.filter((t) => t.background === sheet.background && t.type === "Flaw")}
                      value={sheet.flaw}
                      onPick={(v) => update("flaw", v)}
                    />
                  </div>
                </div>
              ) : (
                <p style={{ marginTop: "0.75rem", opacity: 0.8 }}>Pick a background to choose Personality Trait, Ideal, Bond, and Flaw.</p>
              )}

              <hr style={{ border: "none", borderTop: "1px solid #222", margin: "1rem 0" }} />

              <h3 style={h3}>Features</h3>
              <ul style={{ marginLeft: "1rem" }}>
                {sheet.traits.map((t, idx) => (
                  <li key={idx} style={{ margin: "0.25rem 0" }}>
                    {t}{" "}
                    <button onClick={() => update("traits", sheet.traits.filter((_, i) => i !== idx))} style={linkBtnStyle}>
                      remove
                    </button>
                  </li>
                ))}
              </ul>

              <AddRow placeholder="Add a feature (e.g., Darkvision, Rage, Lucky)" onAdd={(v) => update("traits", [...sheet.traits, v])} />
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <h3 style={h3}>Spells & Slots</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
              <div style={miniCardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
                    const ids = safeSpellIdsByLevel[lvl] ?? [];
                    const optionsForLevel = leveledSpells.filter((s) => s.level === lvl);

                    return (
                      <div
                        key={lvl}
                        style={{
                          border: "1px solid #222",
                          borderRadius: 12,
                          padding: "0.75rem",
                          background: "rgba(0,0,0,0.2)",
                        }}
                      >
                        <strong>Level {lvl}</strong>

                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                          <Field label="Max">
                            <input
                              type="number"
                              value={sheet.spellSlotsMax[lvl]}
                              onChange={(e) =>
                                update("spellSlotsMax", { ...sheet.spellSlotsMax, [lvl]: clamp(Number(e.target.value), 0, 99) })
                              }
                              style={inputStyle}
                            />
                          </Field>
                          <Field label="Used">
                            <input
                              type="number"
                              value={sheet.spellSlotsUsed[lvl]}
                              onChange={(e) =>
                                update("spellSlotsUsed", { ...sheet.spellSlotsUsed, [lvl]: clamp(Number(e.target.value), 0, 99) })
                              }
                              style={inputStyle}
                            />
                          </Field>
                        </div>

                        <div style={{ marginTop: "0.75rem" }}>
                          <SpellSearchAdd
                            label="Search & add spell"
                            options={optionsForLevel}
                            disabledIds={ids}
                            onAdd={(id) => update("spellIdsByLevel", { ...sheet.spellIdsByLevel, [lvl]: [...ids, id] })}
                          />

                          <SelectedSpellList
                            ids={ids}
                            spellsById={spellsById}
                            onRemove={(id) => update("spellIdsByLevel", { ...sheet.spellIdsByLevel, [lvl]: ids.filter((x) => x !== id) })}
                            onInspect={(id) => setSelectedSpellId(id)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <p style={{ marginTop: "1rem", opacity: 0.8 }}>Tip: This page saves automatically (KV) under your login.</p>
      </div>
    </main>
  );
}

function TraitPicker({
  entries,
  value,
  onPick,
}: {
  entries: { id: string; text: string; sourceBook?: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return entries.slice(0, 6);
    return entries.filter((e) => e.text.toLowerCase().includes(query)).slice(0, 10);
  }, [q, entries]);

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={inputStyle} />

      <div style={{ marginTop: "0.5rem", opacity: 0.9, lineHeight: 1.35 }}>
        {value ? (
          <div style={{ padding: "0.6rem 0.75rem", border: "1px solid #222", borderRadius: 12 }}>
            {value}{" "}
            <button onClick={() => onPick("")} style={linkBtnStyle}>
              clear
            </button>
          </div>
        ) : (
          <div style={{ opacity: 0.8 }}>No selection yet.</div>
        )}
      </div>

      <div style={{ marginTop: "0.5rem", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
        {results.map((e, i) => (
          <button
            key={e.id}
            onClick={() => {
              onPick(e.text);
              setQ("");
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "0.6rem 0.8rem",
              border: "none",
              borderTop: i === 0 ? "none" : "1px solid #222",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              cursor: "pointer",
            }}
          >
            {e.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "block", ...style }}>
      <div style={{ fontSize: "0.85rem", opacity: 0.85, marginBottom: "0.25rem" }}>{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={miniCardStyle}>
      <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, marginTop: "0.25rem" }}>{value}</div>
    </div>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={inputStyle} />
      <button
        onClick={() => {
          const t = v.trim();
          if (!t) return;
          onAdd(t);
          setV("");
        }}
        style={btnStyle}
      >
        Add
      </button>
    </div>
  );
}

function SpellSearchAdd({
  label,
  options,
  disabledIds,
  onAdd,
}: {
  label: string;
  options: Spell[];
  disabledIds: string[];
  onAdd: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return options
      .filter((s) => !disabledIds.includes(s.id))
      .filter((s) => s.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [q, options, disabledIds]);

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <Field label={label}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" style={inputStyle} />
      </Field>

      {q.trim() && (
        <div
          style={{
            marginTop: "0.5rem",
            border: "1px solid #222",
            borderRadius: 12,
            overflow: "hidden",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "0.6rem 0.8rem", opacity: 0.8 }}>No matches.</div>
          ) : (
            results.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  onAdd(s.id);
                  setQ("");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 0.8rem",
                  border: "none",
                  borderTop: i === 0 ? "none" : "1px solid #222",
                  background: "rgba(0,0,0,0.35)",
                  color: "white",
                  cursor: "pointer",
                }}
                title={`Add ${s.name}`}
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SelectedSpellList({
  ids,
  spellsById,
  onRemove,
  onInspect,
}: {
  ids: string[];
  spellsById: Map<string, Spell>;
  onRemove: (id: string) => void;
  onInspect: (id: string) => void;
}) {
  if (!ids.length) return <p style={{ opacity: 0.75, marginTop: "0.5rem" }}>None selected.</p>;

  return (
    <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
      {ids.map((id) => {
        const s = spellsById.get(id);
        if (!s) return null;
        return (
          <li key={id} style={{ margin: "0.25rem 0" }}>
            <button onClick={() => onInspect(id)} style={linkBtnStyle}>
              {s.name}
            </button>{" "}
            <button onClick={() => onRemove(id)} style={linkBtnStyle}>
              remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 16,
  padding: "1rem",
  background: "rgba(10,10,10,0.55)",
  backdropFilter: "blur(4px)",
};

const miniCardStyle: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 14,
  padding: "0.75rem",
  background: "rgba(0,0,0,0.35)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.7rem",
  borderRadius: 12,
  border: "1px solid #333",
  background: "rgba(0,0,0,0.45)",
  color: "white",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  borderRadius: 12,
  border: "1px solid #333",
  background: "rgba(212,175,55,0.12)",
  color: "white",
  cursor: "pointer",
};

const linkBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#d4af37",
  cursor: "pointer",
  padding: 0,
};

const h2: React.CSSProperties = { fontSize: "1.2rem", marginBottom: "0.75rem" };
const h3: React.CSSProperties = { fontSize: "1.05rem", marginBottom: "0.25rem" };
