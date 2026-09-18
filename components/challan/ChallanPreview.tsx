"use client";

import { useEffect, useRef, useState } from "react";
import { computeTotals, padCount } from "@/lib/challanSettings";
import { formatChallanDate, type ChallanPdfData, type ChallanPdfParty } from "@/lib/challanPdf";

/**
 * A4 at 72dpi. Choosing this scale makes one CSS pixel equal one PDF point, so
 * the type sizes below are the same numbers the renderer in challanPdf.ts uses
 * and the preview can't drift away from the printed result.
 */
const PAGE_W = 595;
const PAGE_H = 842;
const MM = PAGE_W / 210;            // px per millimetre

function px(mm: number) {
  return `${mm * MM}px`;
}

function partyLines(p: ChallanPdfParty): string[] {
  const lines: string[] = [];
  if (p.address) lines.push(...p.address.split("\n").map((l) => l.trim()).filter(Boolean));
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  if (p.email) lines.push(`Email: ${p.email}`);
  if (p.gst) lines.push(`GSTIN: ${p.gst}`);
  return lines;
}

/**
 * Scale the fixed-size page down to whatever width it is given.
 *
 * The page is laid out once at real A4 proportions and then scaled as a whole,
 * rather than being re-laid-out responsively. Responsive reflow would move text
 * relative to the boxes around it and stop being a preview of the PDF.
 */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / PAGE_W));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, scale };
}

const NAVY = "#0f234a";
const BORDER = "#d6dce5";
const TINT = "#f4f7fb";
const MUTED = "#6e7785";
const INK = "#171e2c";

function Party({ label, party, withLogo }: { label: string; party: ChallanPdfParty; withLogo?: boolean }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${BORDER}` }}>
      <div style={{ background: TINT, borderBottom: `1px solid ${BORDER}`, padding: `${px(1.6)} ${px(4)}` }}>
        <span style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 0.4, color: MUTED }}>{label}</span>
      </div>
      <div style={{ padding: px(4) }}>
        {withLogo && party.logo && (
          <div style={{ height: px(12), marginBottom: px(3), display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={party.logo} alt="" style={{ maxHeight: px(12), maxWidth: px(34), objectFit: "contain" }} />
          </div>
        )}
        <div style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>{party.name || "—"}</div>
        {partyLines(party).map((line, i) => (
          <div key={i} style={{ fontSize: 8.5, color: INK, marginTop: 2 }}>{line}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * On-screen twin of the premium PDF.
 *
 * Only the premium design is previewed. The other three exist for people who
 * want a plainer printout and are chosen from a labelled picker; showing four
 * live previews would cost more than it explains.
 */
export function ChallanPreview({ data }: { data: ChallanPdfData }) {
  const { ref, scale } = useFitScale();
  const totals = computeTotals(data.items);
  const hasRemarks = data.items.some((i) => (i.remarks ?? "").trim() !== "");

  const meta: [string, string][] = [
    ["CHALLAN NO.", data.challanNo || "—"],
    ["DATE", formatChallanDate(data.date)],
  ];
  if (data.vehicle) meta.push(["VEHICLE NO.", data.vehicle.toUpperCase()]);
  if (data.storageTemp) meta.push(["STORAGE TEMP.", data.storageTemp]);

  const extras: string[] = [];
  if (data.dispatchedThrough) extras.push(`Dispatched through: ${data.dispatchedThrough}`);
  if (data.poNumber) extras.push(`P.O. No.: ${data.poNumber}`);

  const th: React.CSSProperties = {
    background: NAVY, color: "#fff", fontSize: 8, fontWeight: 700,
    padding: `${px(2.6)} ${px(3)}`, textAlign: "left", letterSpacing: 0.3,
  };
  const td: React.CSSProperties = {
    fontSize: 9, color: INK, padding: `${px(2.4)} ${px(3)}`,
    border: `1px solid ${BORDER}`, verticalAlign: "middle",
  };

  return (
    <div ref={ref} style={{ width: "100%", height: PAGE_H * scale, overflow: "hidden" }}>
      <div
        style={{
          width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left",
          background: "#fff", color: INK, padding: px(14), boxSizing: "border-box",
          fontFamily: "Helvetica, Arial, sans-serif", position: "relative",
        }}
      >
        {/* Heading — no AtyaDoc logo here by design; the company's own logo sits
            in the FROM box, and the site mark at the foot. */}
        <div style={{ textAlign: "center", paddingTop: px(3) }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: NAVY, letterSpacing: 0.5 }}>
            {(data.type || "Delivery Challan").toUpperCase()}
          </div>
          <div style={{ width: px(32), height: 2, background: "#0d9488", margin: `${px(2)} auto 0` }} />
        </div>

        <div style={{ display: "flex", border: `1px solid ${BORDER}`, background: TINT, marginTop: px(6) }}>
          {meta.map(([label, value], i) => (
            <div key={label} style={{ flex: 1, padding: px(3), borderLeft: i ? `1px solid ${BORDER}` : undefined, minWidth: 0 }}>
              <div style={{ fontSize: 6.5, color: MUTED }}>{label}</div>
              <div style={{
                fontSize: label === "STORAGE TEMP." ? 8 : 10, fontWeight: 700, color: NAVY, marginTop: 2,
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: px(6), marginTop: px(5) }}>
          <Party label="FROM" party={data.from} withLogo />
          <Party label="DELIVER TO" party={data.to} />
        </div>

        {extras.length > 0 && (
          <div style={{ fontSize: 8.5, color: MUTED, marginTop: px(3) }}>{extras.join("     |     ")}</div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: px(5), tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: px(hasRemarks ? 15 : 16), textAlign: "center" }}>S.NO.</th>
              <th style={th}>DESCRIPTION OF GOODS</th>
              <th style={{ ...th, width: px(hasRemarks ? 18 : 22), textAlign: "center" }}>QTY</th>
              <th style={{ ...th, width: px(hasRemarks ? 22 : 26), textAlign: "center" }}>UNIT</th>
              {hasRemarks && <th style={{ ...th, width: px(34) }}>REMARKS</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i} style={{ background: i % 2 ? "#fafbfd" : "#fff" }}>
                <td style={{ ...td, textAlign: "center" }}>{padCount(i + 1)}</td>
                <td style={{ ...td, wordBreak: "break-word" }}>{it.desc || "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{it.qty}</td>
                <td style={{ ...td, textAlign: "center" }}>{(it.unit || "").toUpperCase()}</td>
                {hasRemarks && <td style={{ ...td, wordBreak: "break-word" }}>{it.remarks ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          border: `1px solid ${BORDER}`, background: TINT, padding: px(3), marginTop: px(5),
        }}>
          <div>
            <div style={{ fontSize: 7, color: MUTED }}>TOTAL ITEMS</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: NAVY }}>{padCount(totals.items)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 7, color: MUTED }}>TOTAL QUANTITY</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: NAVY }}>{totals.display}</div>
          </div>
        </div>

        {(data.declaration ?? "").trim() && (
          <div style={{ border: `1px solid ${BORDER}`, padding: px(3), marginTop: px(5) }}>
            <div style={{ fontSize: 6.8, fontWeight: 700, color: MUTED }}>DECLARATION</div>
            <div style={{ fontSize: 8, color: INK, marginTop: 3, lineHeight: 1.4 }}>{data.declaration}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: px(6), marginTop: px(5) }}>
          {[
            { caption: "Receiver's Signature", sub: "Received the above goods in good condition", img: data.receiverSignature },
            { caption: "Authorised Signatory", sub: `For ${data.from.name || "the supplier"}`, img: data.supplierSignature },
          ].map((box) => (
            <div key={box.caption} style={{
              flex: 1, height: px(30), border: `1px solid ${BORDER}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
              padding: px(2),
            }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                {box.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={box.img} alt="" style={{ maxHeight: px(15), maxWidth: px(42), objectFit: "contain" }} />
                ) : null}
              </div>
              <div style={{ width: "80%", borderTop: `1px solid ${BORDER}`, paddingTop: 3, textAlign: "center" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: NAVY }}>{box.caption}</div>
                <div style={{ fontSize: 6.8, color: MUTED }}>{box.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          position: "absolute", right: px(14), bottom: px(7),
          fontSize: 7, color: "#9ea5b0",
        }}>
          atyadoc.in
        </div>
      </div>
    </div>
  );
}
