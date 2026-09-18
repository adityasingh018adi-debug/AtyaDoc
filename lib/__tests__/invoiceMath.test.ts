import { describe, it, expect } from "vitest";
import { computeInvoiceMath } from "@/lib/invoiceMath";

const base = {
  discountType: "percent" as const,
  discountValue: 0,
  shipping: 0,
  roundOff: false,
  taxMode: "cgst-sgst" as const,
};

describe("computeInvoiceMath", () => {
  it("sums line values and charges each line its own GST rate", () => {
    const t = computeInvoiceMath({
      ...base,
      items: [
        { qty: 2, rate: 100, gstPercent: 18 }, // 200 -> 36
        { qty: 1, rate: 100, gstPercent: 5 },  // 100 -> 5
      ],
    });
    expect(t.subtotal).toBe(300);
    expect(t.taxAmount).toBe(41);
    expect(t.total).toBe(341);
  });

  it("splits tax evenly across CGST and SGST, and puts nothing in IGST", () => {
    const t = computeInvoiceMath({ ...base, items: [{ qty: 1, rate: 1000, gstPercent: 18 }] });
    expect(t.cgst).toBe(90);
    expect(t.sgst).toBe(90);
    expect(t.igst).toBe(0);
  });

  it("puts the whole tax in IGST for inter-state invoices", () => {
    const t = computeInvoiceMath({
      ...base, taxMode: "igst", items: [{ qty: 1, rate: 1000, gstPercent: 18 }],
    });
    expect(t.igst).toBe(180);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
  });

  it("spreads a discount across lines so each keeps its own rate", () => {
    // 10% off 300 leaves 270 taxable: 180 at 18% (32.40) + 90 at 5% (4.50).
    const t = computeInvoiceMath({
      ...base,
      discountValue: 10,
      items: [
        { qty: 2, rate: 100, gstPercent: 18 },
        { qty: 1, rate: 100, gstPercent: 5 },
      ],
    });
    expect(t.discount).toBe(30);
    expect(t.taxable).toBe(270);
    expect(t.taxAmount).toBeCloseTo(36.9, 10);
  });

  it("charges the correct tax on invoices totalling under one rupee", () => {
    // Regression: the old code divided by Math.max(subtotal, 1), so a 0.50
    // invoice was prorated against 1.00 and taxed at half what it owed.
    const t = computeInvoiceMath({ ...base, items: [{ qty: 1, rate: 0.5, gstPercent: 18 }] });
    expect(t.taxable).toBe(0.5);
    expect(t.taxAmount).toBeCloseTo(0.09, 10);
  });

  it("never lets a flat discount push the taxable value below zero", () => {
    const t = computeInvoiceMath({
      ...base, discountType: "flat", discountValue: 5000,
      items: [{ qty: 1, rate: 100, gstPercent: 18 }],
    });
    expect(t.discount).toBe(100);
    expect(t.taxable).toBe(0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(0);
  });

  it("ignores a negative discount rather than inflating the invoice", () => {
    const t = computeInvoiceMath({
      ...base, discountType: "flat", discountValue: -50,
      items: [{ qty: 1, rate: 100, gstPercent: 18 }],
    });
    expect(t.discount).toBe(0);
    expect(t.taxable).toBe(100);
  });

  it("adds shipping after tax and rounds only when asked", () => {
    const items = [{ qty: 1, rate: 100, gstPercent: 18 }];
    expect(computeInvoiceMath({ ...base, items, shipping: 49.4 }).total).toBe(167.4);
    expect(computeInvoiceMath({ ...base, items, shipping: 49.4, roundOff: true }).total).toBe(167);
  });

  it("returns zeroes for an empty invoice instead of dividing by zero", () => {
    const t = computeInvoiceMath({ ...base, items: [] });
    expect(t.subtotal).toBe(0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(0);
    expect(Number.isNaN(t.taxAmount)).toBe(false);
  });
});
