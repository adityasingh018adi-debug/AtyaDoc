export type CompanyProfile = {
  id: string;
  name: string;
  address: string;
  logo?: string;       // dataURL
  gst?: string;
  pan?: string;
  fssai?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankDetails?: string; // free text: bank name, account no, IFSC
  upiId?: string;
  signature?: string;  // dataURL
  stamp?: string;       // dataURL
};

const LS_KEY = "doclify_companies_v1";
const LS_LAST_USED = "doclify_companies_last_used_v1";

const DEFAULT_COMPANY: CompanyProfile = {
  id: "default",
  name: "AtyaDoc Business",
  address: "Mumbai, Maharashtra",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function getCompanies(): CompanyProfile[] {
  if (typeof window === "undefined") return [DEFAULT_COMPANY];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? (JSON.parse(raw) as CompanyProfile[]) : [];
    return list.length > 0 ? list : [DEFAULT_COMPANY];
  } catch {
    return [DEFAULT_COMPANY];
  }
}

export function getCompany(id: string): CompanyProfile | undefined {
  return getCompanies().find((c) => c.id === id);
}

function persist(list: CompanyProfile[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function addCompany(data: Omit<CompanyProfile, "id">): CompanyProfile {
  const company: CompanyProfile = { id: uid(), ...data, name: data.name.trim() };
  const next = [...getCompanies().filter((c) => c.id !== "default"), company];
  persist(next);
  setLastUsedCompanyId(company.id);
  return company;
}

export function updateCompany(id: string, data: Partial<Omit<CompanyProfile, "id">>) {
  const next = getCompanies().map((c) => (c.id === id ? { ...c, ...data } : c));
  persist(next);
}

export function deleteCompany(id: string) {
  const next = getCompanies().filter((c) => c.id !== id);
  persist(next.length > 0 ? next : [DEFAULT_COMPANY]);
}

export function getLastUsedCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_LAST_USED);
  } catch {
    return null;
  }
}

export function setLastUsedCompanyId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_LAST_USED, id);
  } catch {
    /* ignore */
  }
}
