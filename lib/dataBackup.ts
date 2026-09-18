/**
 * Backup and restore for everything the app keeps on the device.
 *
 * All records live in localStorage. That is what makes the privacy claim real —
 * invoices and customer addresses never reach a server — but it also means the
 * data has exactly one copy, and clearing site data destroys it with no warning
 * and no recovery. A business that has issued two hundred challans should not
 * lose them to a browser cleanup, so the export below is the way out.
 *
 * The same format restores onto another browser, another machine, or the same
 * machine after a reinstall.
 */

export const BACKUP_FORMAT = "atyadoc.backup";
export const BACKUP_VERSION = 1;

/** Everything the app persists lives under one of these prefixes. */
const PREFIXES = ["doclify_", "kh_"];

/**
 * Short-lived handoff keys — one screen leaving a draft for the next to pick up.
 * Restoring them onto another device would resurrect a half-finished form that
 * device never started, so they are deliberately left out.
 */
const TRANSIENT = new Set([
  "doclify_invoice_prefill",
  "doclify_challan_prefill",
  "doclify_invoice_edit_id",
  "doclify_challan_edit_id",
]);

export interface BackupBundle {
  format: string;
  version: number;
  exportedAt: string;
  origin: string;
  keys: Record<string, string>;
}

export interface SummaryRow {
  label: string;
  count: number;
}

/** Human labels for the keys worth reporting. Counters and flags stay silent. */
const LABELS: Record<string, string> = {
  doclify_invoices_v1: "Invoices",
  doclify_challans_v1: "Challans",
  doclify_challan_items_v1: "Saved items",
  doclify_customers_v1: "Customers",
  doclify_products_v1: "Products",
  doclify_companies_v1: "Company profiles",
  doclify_item_templates_v1: "Item templates",
  doclify_history_v1: "Recent files",
  kh_customers_v2: "Ledger customers",
  kh_transactions_v2: "Ledger entries",
};

function isBackupKey(key: string): boolean {
  return PREFIXES.some((p) => key.startsWith(p)) && !TRANSIENT.has(key);
}

/** Read every backup-worthy key out of this origin's localStorage. */
export function collectKeys(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isBackupKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

export function buildBundle(): BackupBundle {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    origin: typeof window === "undefined" ? "" : window.location.origin,
    keys: collectKeys(),
  };
}

/**
 * Describe a set of keys as counts a person recognises ("12 Invoices"), so both
 * the export and the import screen can say what is actually in hand before
 * anything is written.
 */
export function summarize(keys: Record<string, string>): SummaryRow[] {
  const rows: SummaryRow[] = [];
  for (const [key, label] of Object.entries(LABELS)) {
    const raw = keys[key];
    if (!raw) continue;
    let count = 0;
    try {
      const parsed = JSON.parse(raw);
      count = Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      count = 1; // Unparseable but present — still worth carrying over.
    }
    if (count > 0) rows.push({ label, count });
  }
  if (keys.doclify_supplier_signature_v1) rows.push({ label: "Saved signature", count: 1 });
  return rows;
}

export function totalRecords(keys: Record<string, string>): number {
  return summarize(keys).reduce((sum, r) => sum + r.count, 0);
}

export function parseBundle(text: string): BackupBundle {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Pick the .json file the backup step downloaded.");
  }
  const b = data as Partial<BackupBundle>;
  if (!b || b.format !== BACKUP_FORMAT) {
    throw new Error("That doesn't look like an AtyaDoc backup file.");
  }
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    throw new Error("This file was made by a newer version of AtyaDoc. Update the page and try again.");
  }
  if (!b.keys || typeof b.keys !== "object") {
    throw new Error("This backup file is missing its data.");
  }
  for (const [k, v] of Object.entries(b.keys)) {
    if (typeof v !== "string") throw new Error(`Backup entry "${k}" is corrupt.`);
  }
  return {
    format: b.format,
    version: b.version,
    exportedAt: typeof b.exportedAt === "string" ? b.exportedAt : "",
    origin: typeof b.origin === "string" ? b.origin : "",
    keys: b.keys as Record<string, string>,
  };
}

/**
 * "merge" keeps whatever this device already has and only fills in what's
 * missing; "replace" overwrites. Merge is the safe default — replace is the one
 * that can destroy work, so the UI makes the user choose it deliberately.
 */
export type ImportMode = "merge" | "replace";

export interface ImportResult {
  written: string[];
  skipped: string[];
}

export function applyBundle(bundle: BackupBundle, mode: ImportMode): ImportResult {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(bundle.keys)) {
    if (!isBackupKey(key)) continue; // Never let a file write keys we don't own.
    const existing = localStorage.getItem(key);
    if (mode === "merge" && existing !== null && existing !== "" && existing !== "[]") {
      skipped.push(key);
      continue;
    }
    localStorage.setItem(key, value);
    written.push(key);
  }
  return { written, skipped };
}

export function downloadBundle(bundle: BackupBundle): void {
  const stamp = bundle.exportedAt.slice(0, 10) || "backup";
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `atyadoc-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
