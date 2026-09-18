/**
 * Challan PDF rendering.
 *
 * Everything here draws with jsPDF's text and vector primitives rather than
 * rasterising the on-screen preview. The result is a real document: the text is
 * selectable and searchable, it stays sharp at any zoom, and the file is a few
 * kilobytes instead of a megapixel screenshot. A challan is a commercial record
 * that gets emailed, printed and filed, so it has to behave like one.
 *
 * Kept apart from generatePdf.ts, which is invoice territory — a challan carries
 * no prices, no tax and no totals in money, and mixing the two invites one to
 * grow features that make no sense on the other.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getTemplate, type ChallanTemplateId } from "@/lib/challanTemplates";
import { computeTotals, padCount, DEFAULT_DECLARATION } from "@/lib/challanSettings";

type RGB = [number, number, number];

/* A4 in millimetres, which is the unit jsPDF is set up with below. */
const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;                       // left/right margin
const CONTENT_W = PAGE_W - M * 2;   // 182

/* Palette: white paper, navy ink, light grey rules, a restrained teal accent. */
const NAVY: RGB = [15, 35, 74];
const TEAL: RGB = [13, 148, 136];
const BORDER: RGB = [214, 220, 229];
const TINT: RGB = [244, 247, 251];
const MUTED: RGB = [110, 119, 133];
const INK: RGB = [23, 30, 44];

export interface ChallanPdfParty {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
  /** Only the sending company carries one; see renderPremium for placement. */
  logo?: string | null;
}

export interface ChallanPdfItem {
  desc: string;
  qty: number | string;
  unit: string;
  remarks?: string;
}

export interface ChallanPdfData {
  challanNo: string;
  /** ISO yyyy-mm-dd, as stored by the date input. */
  date: string;
  type?: string;
  from: ChallanPdfParty;
  to: ChallanPdfParty;
  vehicle?: string;
  dispatchedThrough?: string;
  poNumber?: string;
  /** Cold-chain band, printed prominently — see the meta strip. */
  storageTemp?: string;
  items: ChallanPdfItem[];
  declaration?: string;
  /** The business's own signature — reused on every challan. */
  supplierSignature?: string | null;
  /** Signed by whoever takes delivery. Never defaults to the supplier's. */
  receiverSignature?: string | null;
  templateId?: ChallanTemplateId;
}

/** Challans are read by drivers and storekeepers, who expect DD-MM-YYYY. */
export function formatChallanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso || "";
}

function partyLines(p: ChallanPdfParty): string[] {
  const lines: string[] = [];
  if (p.address) lines.push(...p.address.split("\n").map((l) => l.trim()).filter(Boolean));
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  if (p.email) lines.push(`Email: ${p.email}`);
  if (p.gst) lines.push(`GSTIN: ${p.gst}`);
  return lines;
}

function newDoc(): jsPDF {
  return new jsPDF({ unit: "mm", format: "a4", compress: true });
}

/**
 * Draw an image without letting a bad one abort the render.
 *
 * Logos and signatures come from a canvas or an upload, and a corrupt or
 * unsupported data URL makes jsPDF throw. A missing logo is a far better
 * outcome than no challan at all, so the failure is swallowed deliberately.
 */
function drawImage(doc: jsPDF, dataUrl: string, x: number, y: number, w: number, h: number) {
  try {
    doc.addImage(dataUrl, x, y, w, h, undefined, "FAST");
  } catch {
    /* unreadable image — the surrounding text still prints */
  }
}

/**
 * Fit an image inside a box without distorting it.
 *
 * Logos arrive at whatever aspect ratio the business had to hand — a wide
 * wordmark and a square emblem both have to sit in the same slot. Stretching
 * either to fill the box is the one outcome that makes a brand look wrong, so
 * the image is scaled to fit and centred in whatever space is left.
 */
function fitBox(
  doc: jsPDF, dataUrl: string, x: number, y: number, maxW: number, maxH: number
): { w: number; h: number } {
  let ratio = 1;
  try {
    const props = doc.getImageProperties(dataUrl);
    if (props.width > 0 && props.height > 0) ratio = props.width / props.height;
  } catch {
    return { w: 0, h: 0 };   // unreadable — caller lays out as if there were no logo
  }
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  drawImage(doc, dataUrl, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
  return { w, h };
}

/* ── Premium: the default design ─────────────────────────────────────────────
 *
 * Deliberately unbranded at the top: the heading is the document's purpose —
 * DELIVERY CHALLAN — because that is what a security guard at a gate or a clerk
 * filing it needs to read first, and it stays centred. The company's own logo
 * belongs to the sender, so it sits inside the FROM box where the sender is
 * identified rather than competing with the title. AtyaDoc appears once, small,
 * at the foot.
 */
function renderPremium(doc: jsPDF, d: ChallanPdfData): void {
  const title = (d.type || "Delivery Challan").toUpperCase();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...NAVY);
  doc.text(title, PAGE_W / 2, 20, { align: "center" });

  // A short teal rule under the title — the only accent on the page.
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.7);
  doc.line(PAGE_W / 2 - 16, 23.5, PAGE_W / 2 + 16, 23.5);

  /* Meta strip: the facts anyone verifying a delivery looks for. Storage
     temperature earns a cell because a cold-chain consignment is rejected on
     it, so it cannot be buried in a footnote. */
  const meta: [string, string][] = [
    ["CHALLAN NO.", d.challanNo || "—"],
    ["DATE", formatChallanDate(d.date)],
  ];
  if (d.vehicle) meta.push(["VEHICLE NO.", d.vehicle.toUpperCase()]);
  if (d.storageTemp) meta.push(["STORAGE TEMP.", d.storageTemp]);

  const metaY = 30;
  const metaH = 12;
  const cellW = CONTENT_W / meta.length;
  doc.setFillColor(...TINT);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(M, metaY, CONTENT_W, metaH, "FD");
  meta.forEach(([label, value], i) => {
    const x = M + i * cellW;
    if (i > 0) doc.line(x, metaY, x, metaY + metaH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 4, metaY + 4.6);
    doc.setFont("helvetica", "bold");
    // A temperature band is wordier than a challan number, so it gets whatever
    // size keeps it on one line rather than being clipped.
    doc.setFontSize(label === "STORAGE TEMP." ? 8 : 10);
    doc.setTextColor(...NAVY);
    doc.text(value, x + 4, metaY + 9.6, { maxWidth: cellW - 8 });
  });

  /* From / To. Two boxes of equal width so neither party looks subordinate. */
  const boxY = metaY + metaH + 5;
  const boxW = (CONTENT_W - 6) / 2;
  const fromLines = partyLines(d.from);
  const toLines = partyLines(d.to);
  const logo = d.from.logo;
  const LOGO_H = 12;
  const bodyRows = Math.max(fromLines.length, toLines.length);
  const boxH = 15 + Math.max(bodyRows, 3) * 4.6 + (logo ? LOGO_H + 2 : 0);

  const drawParty = (
    x: number, label: string, party: ChallanPdfParty, lines: string[], withLogo: boolean
  ) => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(x, boxY, boxW, boxH, "S");
    doc.setFillColor(...TINT);
    doc.rect(x, boxY, boxW, 7, "F");
    doc.line(x, boxY + 7, x + boxW, boxY + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 4, boxY + 4.7);

    let ty = boxY + 13;
    if (withLogo && logo) {
      // Left-aligned in its own band above the name, so a wide wordmark and a
      // square emblem both look deliberate.
      fitBox(doc, logo, x + 4, boxY + 9, 34, LOGO_H);
      ty = boxY + 9 + LOGO_H + 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(party.name || "—", x + 4, ty, { maxWidth: boxW - 8 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    let ly = ty + 5;
    for (const line of lines) {
      doc.text(line, x + 4, ly, { maxWidth: boxW - 8 });
      ly += 4.6;
    }
  };

  drawParty(M, "FROM", d.from, fromLines, true);
  drawParty(M + boxW + 6, "DELIVER TO", d.to, toLines, false);

  let y = boxY + boxH + 5;

  /* A second meta line for fields that don't earn a strip cell. */
  const extras: string[] = [];
  if (d.dispatchedThrough) extras.push(`Dispatched through: ${d.dispatchedThrough}`);
  if (d.poNumber) extras.push(`P.O. No.: ${d.poNumber}`);
  if (extras.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(extras.join("     |     "), M, y);
    y += 5;
  }

  /* Items. A challan lists what was handed over, so quantity and unit sit in
     their own columns and are never merged into one string. */
  const hasRemarks = d.items.some((i) => (i.remarks ?? "").trim() !== "");
  const head = hasRemarks
    ? [["S.NO.", "DESCRIPTION OF GOODS", "QTY", "UNIT", "REMARKS"]]
    : [["S.NO.", "DESCRIPTION OF GOODS", "QTY", "UNIT"]];

  autoTable(doc, {
    startY: y,
    head,
    body: d.items.map((it, i) => {
      const row = [padCount(i + 1), it.desc || "—", String(it.qty ?? ""), (it.unit || "").toUpperCase()];
      return hasRemarks ? [...row, it.remarks ?? ""] : row;
    }),
    theme: "grid",
    headStyles: {
      fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold",
      fontSize: 8, cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
      lineWidth: 0.3, lineColor: NAVY,
    },
    bodyStyles: {
      textColor: INK, fontSize: 9, cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 },
      lineWidth: 0.25, lineColor: BORDER,
    },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    styles: { font: "helvetica", overflow: "linebreak", valign: "middle" },
    columnStyles: hasRemarks
      ? {
          0: { cellWidth: 15, halign: "center" },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 34 },
        }
      : {
          0: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 22, halign: "center" },
          3: { cellWidth: 26, halign: "center" },
        },
    margin: { left: M, right: M, bottom: 24 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  /* Everything below travels together: splitting the totals from the signatures
     across a page break would leave an unsigned last page. */
  const declaration = (d.declaration ?? DEFAULT_DECLARATION).trim();
  const declLines = declaration ? doc.splitTextToSize(declaration, CONTENT_W - 8) : [];
  const declH = declaration ? 9 + declLines.length * 4 : 0;
  const tailH = 13 + 4 + declH + (declaration ? 5 : 0) + 30;

  if (y + tailH > PAGE_H - 20) {
    doc.addPage();
    y = 20;
  }
  y += 5;

  /* Totals. Quantities are only summed when every line shares a unit — see
     computeTotals; "Mixed Units" is the honest answer otherwise. */
  const totals = computeTotals(d.items);
  const barH = 13;
  doc.setFillColor(...TINT);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CONTENT_W, barH, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL ITEMS", M + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(padCount(totals.items), M + 4, y + 10.4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL QUANTITY", PAGE_W - M - 4, y + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(totals.display, PAGE_W - M - 4, y + 10.4, { align: "right" });

  y += barH + 5;

  if (declaration) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(M, y, CONTENT_W, declH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text("DECLARATION", M + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(declLines, M + 4, y + 9.6);
    y += declH + 5;
  }

  /* Signatures. Two boxes, two distinct people: the receiver acknowledges the
     goods, the supplier authorises the despatch. */
  const sigH = 30;
  const sigW = (CONTENT_W - 6) / 2;

  const drawSignature = (x: number, caption: string, subCaption: string, image?: string | null) => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(x, y, sigW, sigH, "S");
    if (image) fitBox(doc, image, x + sigW / 2 - 21, y + 3, 42, 15);
    doc.setDrawColor(...BORDER);
    doc.line(x + 8, y + sigH - 10, x + sigW - 8, y + sigH - 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(caption, x + sigW / 2, y + sigH - 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(subCaption, x + sigW / 2, y + sigH - 2.4, { align: "center", maxWidth: sigW - 8 });
  };

  drawSignature(M, "Receiver's Signature", "Received the above goods in good condition", d.receiverSignature);
  drawSignature(M + sigW + 6, "Authorised Signatory", `For ${d.from.name || "the supplier"}`, d.supplierSignature);
}

/* ── Formal: the plainer, ruled layout many businesses already print ──────── */
function renderFormal(doc: jsPDF, d: ChallanPdfData, accent: RGB): void {
  if (d.from.logo) fitBox(doc, d.from.logo, M, 10, 30, 12);

  doc.setFont("times", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...accent);
  doc.text((d.type || "Delivery Challan").toUpperCase(), PAGE_W / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.setFont("times", "bold");
  doc.text("Date:", M, 32);
  doc.text("Challan No:", PAGE_W - M - 46, 32);
  doc.setFont("times", "normal");
  doc.text(formatChallanDate(d.date), M + 14, 32);
  doc.text(d.challanNo, PAGE_W - M, 32, { align: "right" });

  let y = 44;
  const block = (label: string, party: ChallanPdfParty) => {
    doc.setFont("times", "bold");
    doc.text(label, M, y);
    doc.setFont("times", "normal");
    doc.text(party.name || "", M + 18, y);
    y += 6;
    for (const line of partyLines(party)) {
      doc.text(line, M + 18, y);
      y += 6;
    }
    y += 2;
  };
  block("From:", d.from);
  block("To:", d.to);
  if (d.vehicle) { doc.text(`Vehicle No: ${d.vehicle.toUpperCase()}`, M, y); y += 7; }
  if (d.storageTemp) {
    doc.setFont("times", "bold");
    doc.text(`Storage Temperature: ${d.storageTemp}`, M, y);
    doc.setFont("times", "normal");
    y += 7;
  }

  autoTable(doc, {
    startY: y + 2,
    head: [["Sr. No", "Item Name", "Quantity", "Unit"]],
    body: d.items.map((it, i) => [i + 1, it.desc, String(it.qty ?? ""), it.unit]),
    theme: "grid",
    headStyles: { fillColor: [255, 255, 255], textColor: accent, fontStyle: "bold", lineWidth: 0.3, lineColor: [60, 60, 60] },
    bodyStyles: { textColor: [20, 20, 20], lineWidth: 0.2, lineColor: [90, 90, 90] },
    styles: { font: "times", fontSize: 10, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 18, halign: "center" }, 2: { cellWidth: 26, halign: "center" }, 3: { cellWidth: 24, halign: "center" } },
    margin: { left: M, right: M, bottom: 30 },
  });

  drawSimpleTail(doc, d, "times");
}

/* ── Classic: dark header band, compact ──────────────────────────────────── */
function renderClassic(doc: jsPDF, d: ChallanPdfData, accent: RGB): void {
  doc.setFillColor(...accent);
  doc.rect(0, 0, PAGE_W, 30, "F");
  if (d.from.logo) fitBox(doc, d.from.logo, M, 7, 26, 16);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.setFont("helvetica", "bold");
  doc.text((d.type || "Delivery Challan").toUpperCase(), d.from.logo ? M + 30 : M, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`#${d.challanNo}`, PAGE_W - M, 20, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("FROM", M, 42);
  doc.text("DELIVER TO", 110, 42);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text([d.from.name, ...partyLines(d.from)].filter(Boolean).join(", "), M, 49, { maxWidth: 85 });
  doc.text([d.to.name, ...partyLines(d.to)].filter(Boolean).join(", "), 110, 49, { maxWidth: 80 });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  const meta = [`Date: ${formatChallanDate(d.date)}`];
  if (d.vehicle) meta.push(`Vehicle No: ${d.vehicle.toUpperCase()}`);
  if (d.storageTemp) meta.push(`Storage: ${d.storageTemp}`);
  doc.text(meta.join("  |  "), M, 70, { maxWidth: CONTENT_W });

  autoTable(doc, {
    startY: 78,
    head: [["#", "Item Description", "Quantity", "Unit"]],
    body: d.items.map((it, i) => [i + 1, it.desc, String(it.qty ?? ""), it.unit]),
    headStyles: { fillColor: accent, textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 26, halign: "center" }, 3: { cellWidth: 24, halign: "center" } },
    margin: { left: M, right: M, bottom: 30 },
  });

  drawSimpleTail(doc, d, "helvetica");
}

/* ── Minimal: hairlines only, cheapest to print ──────────────────────────── */
function renderMinimal(doc: jsPDF, d: ChallanPdfData, accent: RGB): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...accent);
  doc.text((d.type || "Delivery Challan").toUpperCase(), M, 24);

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(M, 28, PAGE_W - M, 28);

  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${d.challanNo}`, PAGE_W - M, 24, { align: "right" });
  doc.text(`Date ${formatChallanDate(d.date)}`, PAGE_W - M, 34, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(d.from.name || "", M, 38);
  doc.setFont("helvetica", "normal");
  let y = 44;
  for (const line of partyLines(d.from)) { doc.text(line, M, y); y += 5; }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("To", M, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(d.to.name || "", M, y); y += 5;
  for (const line of partyLines(d.to)) { doc.text(line, M, y); y += 5; }
  if (d.vehicle) { y += 2; doc.text(`Vehicle ${d.vehicle.toUpperCase()}`, M, y); y += 5; }
  if (d.storageTemp) { y += 2; doc.text(`Storage ${d.storageTemp}`, M, y); y += 5; }

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Item", "Qty", "Unit"]],
    body: d.items.map((it, i) => [i + 1, it.desc, String(it.qty ?? ""), it.unit]),
    theme: "plain",
    headStyles: { textColor: accent, fontStyle: "bold", lineWidth: { bottom: 0.3 }, lineColor: [150, 150, 150] },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 20, halign: "right" }, 3: { cellWidth: 22 } },
    margin: { left: M, right: M, bottom: 30 },
  });

  drawSimpleTail(doc, d, "helvetica");
}

/**
 * Declaration and signature lines for the three simpler designs.
 *
 * Shared so a change to what a challan must state — the declaration is
 * user-editable — reaches every design at once.
 */
function drawSimpleTail(doc: jsPDF, d: ChallanPdfData, font: "times" | "helvetica"): void {
  let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  const declaration = (d.declaration ?? DEFAULT_DECLARATION).trim();

  if (y + 46 > PAGE_H - 20) {
    doc.addPage();
    y = 24;
  }

  const totals = computeTotals(d.items);
  doc.setFont(font, "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(`Total items: ${padCount(totals.items)}     Total quantity: ${totals.display}`, M, y);
  y += 8;

  if (declaration) {
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(declaration, CONTENT_W);
    doc.text(lines, M, y);
    y += lines.length * 4 + 10;
  }

  const sigY = Math.min(y + 14, PAGE_H - 30);
  if (d.receiverSignature) fitBox(doc, d.receiverSignature, M + 2, sigY - 16, 42, 13);
  if (d.supplierSignature) fitBox(doc, d.supplierSignature, PAGE_W - M - 44, sigY - 16, 42, 13);

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.line(M, sigY, M + 48, sigY);
  doc.line(PAGE_W - M - 48, sigY, PAGE_W - M, sigY);

  doc.setFont(font, "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Receiver's Signature", M + 24, sigY + 5, { align: "center" });
  doc.text("Authorised Signatory", PAGE_W - M - 24, sigY + 5, { align: "center" });
}

/**
 * Site mark and pagination, applied to every page after the content is laid out.
 *
 * Small and bottom-right by design: the challan belongs to the business issuing
 * it, not to the tool that printed it.
 */
function stampFooter(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(158, 165, 176);
    doc.text("atyadoc.in", PAGE_W - M, PAGE_H - 9, { align: "right" });
    if (pages > 1) {
      doc.text(`Page ${p} of ${pages}`, M, PAGE_H - 9);
    }
  }
}

/** Build the document without writing it anywhere, so callers can save or print. */
export function buildChallanPdf(data: ChallanPdfData): jsPDF {
  const doc = newDoc();
  const template = getTemplate(data.templateId);

  switch (template.id) {
    case "formal":
      renderFormal(doc, data, template.accent);
      break;
    case "classic":
      renderClassic(doc, data, template.accent);
      break;
    case "minimal":
      renderMinimal(doc, data, template.accent);
      break;
    default:
      renderPremium(doc, data);
  }

  stampFooter(doc);
  return doc;
}

function fileName(data: ChallanPdfData): string {
  const safe = (data.challanNo || "challan").replace(/[^\w.-]+/g, "-");
  return `${safe}.pdf`;
}

export function downloadChallanPdf(data: ChallanPdfData): void {
  buildChallanPdf(data).save(fileName(data));
}

/**
 * Send the challan straight to the printer.
 *
 * Printing the PDF rather than the web page means the driver's copy is the same
 * document that gets emailed — the browser's own print styles never enter into
 * it. A blocked popup falls back to a download so the action isn't simply lost.
 */
export function printChallanPdf(data: ChallanPdfData): boolean {
  const doc = buildChallanPdf(data);
  doc.autoPrint();
  const url = doc.output("bloburl") as unknown as string;
  const win = window.open(url, "_blank");
  if (!win) {
    doc.save(fileName(data));
    return false;
  }
  return true;
}
