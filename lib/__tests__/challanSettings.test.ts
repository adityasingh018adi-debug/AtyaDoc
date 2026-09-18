import { describe, it, expect } from "vitest";
import { computeTotals, formatChallanNumber, padCount, type NumberingConfig } from "@/lib/challanSettings";

describe("computeTotals", () => {
  it("sums quantities when every line shares a unit", () => {
    const t = computeTotals([
      { qty: 50, unit: "KG" },
      { qty: 25, unit: "KG" },
    ]);
    expect(t.items).toBe(2);
    expect(t.quantity).toBe(75);
    expect(t.display).toBe("75 KG");
  });

  it("refuses to add quantities across different units", () => {
    // 10 KG and 5 NOS is not 15 of anything, and printing 15 on a delivery
    // note is what starts an argument at the gate.
    const t = computeTotals([
      { qty: 10, unit: "KG" },
      { qty: 5, unit: "NOS" },
    ]);
    expect(t.quantity).toBeNull();
    expect(t.display).toBe("Mixed Units");
  });

  it("treats a unit as the same regardless of case or padding", () => {
    const t = computeTotals([
      { qty: 2, unit: "kg" },
      { qty: 3, unit: " KG " },
    ]);
    expect(t.display).toBe("5 KG");
  });

  it("still totals when no unit is given at all", () => {
    const t = computeTotals([
      { qty: 4, unit: "" },
      { qty: 6, unit: "" },
    ]);
    expect(t.display).toBe("10");
  });

  it("counts a line with a unit but no quantity", () => {
    const t = computeTotals([{ qty: 0, unit: "BOX" }]);
    expect(t.items).toBe(1);
    expect(t.display).toBe("0 BOX");
  });

  it("ignores rows that are entirely blank", () => {
    const t = computeTotals([
      { qty: 5, unit: "KG" },
      { qty: 0, unit: "" },
    ]);
    expect(t.items).toBe(1);
    expect(t.display).toBe("5 KG");
  });

  it("accepts quantities that arrive as strings from the form", () => {
    const t = computeTotals([
      { qty: "12", unit: "NOS" },
      { qty: "8", unit: "NOS" },
    ]);
    expect(t.display).toBe("20 NOS");
  });

  it("returns an empty total rather than NaN for no items", () => {
    const t = computeTotals([]);
    expect(t.items).toBe(0);
    expect(t.display).toBe("0");
  });
});

describe("formatChallanNumber", () => {
  const cfg = (over: Partial<NumberingConfig> = {}): NumberingConfig => ({
    prefix: "CH-", usePrefix: true, next: 1, pad: 4, ...over,
  });

  it("pads to the configured width and applies the prefix", () => {
    expect(formatChallanNumber(7, cfg())).toBe("CH-0007");
  });

  it("drops the prefix when it is switched off", () => {
    expect(formatChallanNumber(7, cfg({ usePrefix: false }))).toBe("0007");
  });

  it("does not truncate a number longer than the padding", () => {
    expect(formatChallanNumber(123456, cfg({ pad: 4 }))).toBe("CH-123456");
  });

  it("treats a prefix that is on but empty as no prefix", () => {
    expect(formatChallanNumber(7, cfg({ prefix: "" }))).toBe("0007");
  });
});

describe("padCount", () => {
  it("writes single digits the way they are written by hand", () => {
    expect(padCount(3)).toBe("03");
    expect(padCount(12)).toBe("12");
    expect(padCount(120)).toBe("120");
  });
});
