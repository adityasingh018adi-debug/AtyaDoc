/**
 * Challan designs.
 *
 * The PDF layout is a presentation choice, so it lives apart from the challan
 * data. A saved challan stores only which design it used; switching design
 * re-renders the same record rather than editing anything, so a challan can be
 * reissued in a different style without retyping it.
 *
 * "premium" is the default: the centred-title, boxed From/To layout that reads
 * as a proper commercial document. "formal" is the plainer ruled version many
 * businesses already print from Word, kept because customers recognise it.
 */

export type ChallanTemplateId = "premium" | "formal" | "classic" | "minimal";

export interface ChallanTemplate {
  id: ChallanTemplateId;
  name: string;
  description: string;
  /** Accent colour as RGB, used for rules and headings. */
  accent: [number, number, number];
}

export const CHALLAN_TEMPLATES: ChallanTemplate[] = [
  {
    id: "premium",
    name: "Premium",
    description: "Navy heading, boxed From/To, ruled table and a totals bar. The default, and the one to hand a customer.",
    accent: [15, 35, 74],
  },
  {
    id: "formal",
    name: "Formal",
    description: "Centred title, From/To blocks, ruled table and declaration. The layout most paper challans use.",
    accent: [192, 0, 0],
  },
  {
    id: "classic",
    name: "Classic",
    description: "Dark header band with the challan number set to the right. Modern and compact.",
    accent: [15, 23, 42],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "No fills or heavy rules — plain type on white. Cheapest to print and easiest to read on a phone.",
    accent: [71, 85, 105],
  },
];

export const DEFAULT_CHALLAN_TEMPLATE: ChallanTemplateId = "premium";

const LS_TEMPLATE = "doclify_challan_template_v1";

/** Remembering the last design avoids re-picking it on every challan. */
export function getPreferredTemplate(): ChallanTemplateId {
  if (typeof window === "undefined") return DEFAULT_CHALLAN_TEMPLATE;
  try {
    const raw = localStorage.getItem(LS_TEMPLATE);
    if (raw && CHALLAN_TEMPLATES.some((t) => t.id === raw)) {
      return raw as ChallanTemplateId;
    }
  } catch { /* storage blocked — fall through to the default */ }
  return DEFAULT_CHALLAN_TEMPLATE;
}

export function setPreferredTemplate(id: ChallanTemplateId): void {
  try {
    localStorage.setItem(LS_TEMPLATE, id);
  } catch { /* storage blocked; the choice just won't persist */ }
}

export function getTemplate(id: string | undefined): ChallanTemplate {
  return (
    CHALLAN_TEMPLATES.find((t) => t.id === id) ??
    CHALLAN_TEMPLATES.find((t) => t.id === DEFAULT_CHALLAN_TEMPLATE)!
  );
}
