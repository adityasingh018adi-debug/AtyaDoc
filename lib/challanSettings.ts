/**
 * Settings that persist across challans: the supplier's signature, the numbering
 * scheme, the default declaration, units, and cold-chain storage temperatures.
 *
 * These are deliberately separate from any individual challan. The whole point
 * is that creating the next challan requires only a customer and some items —
 * everything else is already known.
 *
 * Storage keys keep the historical `doclify_` prefix. They are internal
 * identifiers holding live user data; renaming them would orphan every saved
 * signature and setting on existing devices.
 */

const LS_SUPPLIER_SIG = "doclify_supplier_signature_v1";
const LS_NUMBERING = "doclify_challan_numbering_v1";
const LS_DECLARATION = "doclify_challan_declaration_v1";
const LS_CUSTOM_UNITS = "doclify_challan_units_v1";
const LS_CUSTOM_TEMPS = "doclify_challan_temps_v1";

export const DEFAULT_DECLARATION =
  "This is a delivery challan for goods supplied. No prices are mentioned as it is only for delivery acknowledgment.";

/** Images are stored as data URLs, so they never leave the device. */
export const IMAGE_MAX_BYTES = 1_000_000; // 1 MB, ample for a signature or logo
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface NumberingConfig {
  /** Prefix such as "CH-". Ignored entirely when usePrefix is false. */
  prefix: string;
  usePrefix: boolean;
  /** The number the next challan will use. */
  next: number;
  /** Zero-padding width, so 1 renders as 0001. */
  pad: number;
}

export const DEFAULT_NUMBERING: NumberingConfig = {
  prefix: "CH-",
  usePrefix: true,
  next: 1,
  pad: 4,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full — the caller surfaces this to the user */
  }
}

/* ── Supplier signature ──────────────────────────────────────────────────── */

export function getSupplierSignature(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_SUPPLIER_SIG);
  } catch {
    return null;
  }
}

export function setSupplierSignature(dataUrl: string): void {
  try {
    localStorage.setItem(LS_SUPPLIER_SIG, dataUrl);
  } catch {
    /* ignore */
  }
}

export function removeSupplierSignature(): void {
  try {
    localStorage.removeItem(LS_SUPPLIER_SIG);
  } catch {
    /* ignore */
  }
}

/**
 * Validate an image upload before it reaches storage.
 *
 * Only real image types are accepted, and the size is capped — a large file
 * would both bloat every generated PDF and risk filling the origin's storage
 * quota, which would silently start failing other saves.
 */
export function validateImageFile(file: File, kind: "signature" | "logo" = "signature"): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return `The ${kind} must be a PNG, JPG or WebP image. A transparent PNG looks best.`;
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use one under 1 MB.`;
  }
  return null;
}

/* ── Numbering ───────────────────────────────────────────────────────────── */

/**
 * The counter used before numbering became configurable. Read once so a device
 * that already issued CH-0007 continues at 8 rather than restarting at 1 and
 * producing a second challan with a number the business has already used.
 */
const LS_LEGACY_COUNTER = "doclify_challan_counter_v1";

export function getNumbering(): NumberingConfig {
  if (typeof window === "undefined") return DEFAULT_NUMBERING;
  const stored = read<NumberingConfig | null>(LS_NUMBERING, null);
  if (stored) return { ...DEFAULT_NUMBERING, ...stored };

  let next = DEFAULT_NUMBERING.next;
  try {
    const legacy = parseInt(localStorage.getItem(LS_LEGACY_COUNTER) ?? "", 10);
    if (Number.isFinite(legacy) && legacy > 0) next = legacy + 1;
  } catch {
    /* storage blocked — start from the default */
  }
  return { ...DEFAULT_NUMBERING, next };
}

export function setNumbering(cfg: NumberingConfig): void {
  write(LS_NUMBERING, cfg);
}

export function formatChallanNumber(n: number, cfg: NumberingConfig = getNumbering()): string {
  const padded = String(n).padStart(Math.max(1, cfg.pad), "0");
  return cfg.usePrefix && cfg.prefix ? `${cfg.prefix}${padded}` : padded;
}

/** Peek at the next number without consuming it — used to fill a new form. */
export function peekNextChallanNumber(): string {
  const cfg = getNumbering();
  return formatChallanNumber(cfg.next, cfg);
}

/**
 * Consume the next number. Called only when a challan is actually saved, so
 * opening the form and abandoning it doesn't burn a number and leave a gap in
 * the business's records.
 */
export function consumeChallanNumber(): string {
  const cfg = getNumbering();
  const value = formatChallanNumber(cfg.next, cfg);
  setNumbering({ ...cfg, next: cfg.next + 1 });
  return value;
}

/* ── Declaration ─────────────────────────────────────────────────────────── */

export function getDeclaration(): string {
  if (typeof window === "undefined") return DEFAULT_DECLARATION;
  try {
    return localStorage.getItem(LS_DECLARATION) ?? DEFAULT_DECLARATION;
  } catch {
    return DEFAULT_DECLARATION;
  }
}

export function setDeclaration(text: string): void {
  try {
    localStorage.setItem(LS_DECLARATION, text);
  } catch {
    /* ignore */
  }
}

/* ── Storage temperature ─────────────────────────────────────────────────── */

/**
 * Cold-chain bands.
 *
 * Perishable goods are handed over against a temperature the carrier is
 * accountable for keeping, so the challan has to state it: the band on the
 * document is what a rejection at the receiving dock is argued over. The
 * presets are the ones Indian food and pharma distributors actually use; a
 * business with its own wording types it in and it is remembered.
 */
export const STORAGE_TEMPERATURES = [
  "Frozen (-18°C or below)",
  "Chilled (0°C to 4°C)",
  "Cold (2°C to 8°C)",
  "Cool (8°C to 15°C)",
  "Ambient / Room temperature",
  "Dry storage",
] as const;

export function getStorageTemperatures(): string[] {
  const custom = read<string[]>(LS_CUSTOM_TEMPS, []);
  const seen = new Set(STORAGE_TEMPERATURES.map((t) => t.toLowerCase()));
  return [...STORAGE_TEMPERATURES, ...custom.filter((t) => t && !seen.has(t.toLowerCase()))];
}

export function rememberStorageTemperature(value: string): void {
  const temp = String(value ?? "").trim();
  if (!temp) return;
  const known = new Set(STORAGE_TEMPERATURES.map((t) => t.toLowerCase()));
  const stored = read<string[]>(LS_CUSTOM_TEMPS, []);
  for (const t of stored) known.add(t.toLowerCase());
  if (known.has(temp.toLowerCase())) return;
  write(LS_CUSTOM_TEMPS, [...stored, temp]);
}

/* ── Units ───────────────────────────────────────────────────────────────── */

export const COMMON_UNITS = [
  "NOS", "KG", "GM", "LITRE", "ML", "PACK",
  "BOX", "TRAY", "LOAF", "PORTION", "PCS", "DOZEN",
] as const;

/**
 * Units the user typed that aren't in COMMON_UNITS.
 *
 * Trades sell in things no fixed list anticipates — "bori", "peti", "half tray".
 * Remembering them means a unit is typed once and then picked from the dropdown
 * forever after, which also keeps spelling consistent so totals still collapse
 * to a single unit instead of reporting "Mixed Units".
 */
export function getUnits(): string[] {
  const custom = read<string[]>(LS_CUSTOM_UNITS, []);
  const seen = new Set(COMMON_UNITS.map((u) => u.toUpperCase()));
  return [...COMMON_UNITS, ...custom.filter((u) => u && !seen.has(u.toUpperCase()))];
}

export function rememberUnits(units: string[]): void {
  const known = new Set(COMMON_UNITS.map((u) => u.toUpperCase()));
  const stored = read<string[]>(LS_CUSTOM_UNITS, []);
  for (const u of stored) known.add(u.toUpperCase());

  const additions: string[] = [];
  for (const raw of units) {
    const unit = String(raw ?? "").trim().toUpperCase();
    if (!unit || known.has(unit)) continue;
    known.add(unit);
    additions.push(unit);
  }
  if (additions.length) write(LS_CUSTOM_UNITS, [...stored, ...additions]);
}

/* ── Totals ──────────────────────────────────────────────────────────────── */

export interface ChallanTotals {
  items: number;
  /** Null when units differ, because adding 10 KG to 5 NOS means nothing. */
  quantity: number | null;
  unit: string | null;
  display: string;
}

/**
 * Totals across line items.
 *
 * Summing quantities only makes sense when every line shares a unit. Ten
 * kilograms plus five pieces is not fifteen of anything, and printing "15" on a
 * delivery document invites a dispute at handover — so mixed units are reported
 * as such rather than added.
 */
export function computeTotals(items: { qty: number | string; unit: string }[]): ChallanTotals {
  const counted = items.filter((i) => String(i.unit ?? "").trim() !== "" || Number(i.qty) > 0);
  const units = new Set(counted.map((i) => String(i.unit ?? "").trim().toUpperCase()).filter(Boolean));
  const sum = counted.reduce((n, i) => n + (Number(i.qty) || 0), 0);

  if (units.size === 1) {
    const unit = [...units][0];
    return { items: counted.length, quantity: sum, unit, display: `${sum} ${unit}` };
  }
  if (units.size === 0) {
    return { items: counted.length, quantity: sum, unit: null, display: String(sum) };
  }
  return { items: counted.length, quantity: null, unit: null, display: "Mixed Units" };
}

/** "03" rather than "3" — matches how challans are written by hand. */
export function padCount(n: number): string {
  return String(n).padStart(2, "0");
}
