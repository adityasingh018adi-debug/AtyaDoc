/**
 * A permanent item list, kept per company.
 *
 * A distributor sends the same goods out week after week, so retyping
 * "Multigrain Bread Loaf 400g — LOAF" on every challan is wasted effort and a
 * source of inconsistency: two spellings of one product split the records and
 * stop quantities collapsing to a single unit in the totals.
 *
 * The catalogue is scoped by company rather than global because one device may
 * issue challans for more than one business, and a bakery's item list has no
 * business appearing when the user switches to their hardware company. Items
 * carry their usual unit and storage temperature so picking one fills the whole
 * row.
 */

const LS_KEY = "doclify_challan_items_v1";

export interface CatalogItem {
  id: string;
  /** Which company's list this belongs to. */
  companyId: string;
  desc: string;
  unit: string;
  /** The quantity usually sent, used to prefill the row. */
  defaultQty?: number;
  /** Cold-chain band this item ships at, if it has one. */
  storageTemp?: string;
  createdAt: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function readAll(): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CatalogItem[]) : [];
  } catch {
    return [];
  }
}

function persist(list: CatalogItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Items saved for one company, alphabetical so the picker is scannable. */
export function getCatalog(companyId: string): CatalogItem[] {
  return readAll()
    .filter((i) => i.companyId === companyId)
    .sort((a, b) => a.desc.localeCompare(b.desc));
}

/** Compare on description alone — the same product at a different quantity is
 *  still the same product, and unit casing shouldn't create a duplicate. */
function sameItem(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function addCatalogItem(
  companyId: string,
  data: { desc: string; unit: string; defaultQty?: number; storageTemp?: string }
): CatalogItem | null {
  const desc = data.desc.trim();
  if (!desc) return null;

  const all = readAll();
  const existing = all.find((i) => i.companyId === companyId && sameItem(i.desc, desc));
  if (existing) {
    // Already known — refresh the unit and temperature rather than duplicating,
    // so the catalogue tracks how the item is actually being sent now.
    const updated: CatalogItem = {
      ...existing,
      unit: data.unit || existing.unit,
      defaultQty: data.defaultQty ?? existing.defaultQty,
      storageTemp: data.storageTemp ?? existing.storageTemp,
    };
    persist(all.map((i) => (i.id === existing.id ? updated : i)));
    return updated;
  }

  const item: CatalogItem = {
    id: uid(),
    companyId,
    desc,
    unit: (data.unit || "NOS").trim().toUpperCase(),
    defaultQty: data.defaultQty,
    storageTemp: data.storageTemp,
    createdAt: new Date().toISOString(),
  };
  persist([...all, item]);
  return item;
}

export function updateCatalogItem(id: string, data: Partial<Omit<CatalogItem, "id" | "companyId" | "createdAt">>) {
  persist(readAll().map((i) => (i.id === id ? { ...i, ...data } : i)));
}

export function deleteCatalogItem(id: string) {
  persist(readAll().filter((i) => i.id !== id));
}

/** Remove a whole company's list — used when that company is deleted. */
export function clearCatalog(companyId: string) {
  persist(readAll().filter((i) => i.companyId !== companyId));
}

/**
 * Fold the lines of a saved challan into the company's catalogue.
 *
 * Called on save, so the list builds itself out of real work instead of asking
 * the user to seed it up front. Blank rows are skipped: an untouched empty line
 * is not a product.
 */
export function rememberChallanItems(
  companyId: string,
  items: { desc: string; qty: number | string; unit: string }[],
  storageTemp?: string
): void {
  if (!companyId) return;
  for (const item of items) {
    if (!item.desc?.trim()) continue;
    addCatalogItem(companyId, {
      desc: item.desc,
      unit: item.unit,
      defaultQty: Number(item.qty) || undefined,
      storageTemp: storageTemp || undefined,
    });
  }
}

export function searchCatalog(companyId: string, query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  const list = getCatalog(companyId);
  if (!q) return list;
  return list.filter((i) => i.desc.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q));
}
