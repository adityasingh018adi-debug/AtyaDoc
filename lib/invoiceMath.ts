/**
 * Invoice arithmetic, kept apart from the PDF renderer so it can be tested.
 *
 * These numbers go on a document a customer pays against and an accountant
 * files, so they are the part of this codebase least able to afford a quiet
 * mistake. Nothing here touches jsPDF or the DOM — it is plain arithmetic in,
 * plain arithmetic out.
 */

export type TaxMode = "cgst-sgst" | "igst";
export type DiscountType = "percent" | "flat";

export interface InvoiceMathInput {
  items: { qty: number; rate: number; gstPercent: number }[];
  discountType: DiscountType;
  discountValue: number;
  shipping: number;
  roundOff: boolean;
  taxMode: TaxMode;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  /** Value tax is charged on: subtotal less discount, never below zero. */
  taxable: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/**
 * Totals for an invoice.
 *
 * Tax is computed per line rather than on the taxable total, because lines can
 * carry different GST rates and a single blended rate would be wrong the moment
 * an invoice mixes 5% and 18% goods. A discount is spread across lines in
 * proportion to their value, so it reduces the tax on each at that line's own
 * rate.
 */
export function computeInvoiceMath(input: InvoiceMathInput): InvoiceTotals {
  const { items, discountType, discountValue, shipping, roundOff, taxMode } = input;

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.rate, 0);

  const rawDiscount = discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;
  // A discount cannot exceed the goods, and cannot be negative — either would
  // produce a taxable value that means nothing.
  const discount = Math.min(Math.max(rawDiscount, 0), subtotal);
  const taxable = subtotal - discount;

  // Share of the original value that survives the discount. Guarding on
  // `subtotal > 0` rather than dividing by `Math.max(subtotal, 1)`: the latter
  // silently under-charges tax on any invoice totalling less than ₹1, because
  // it divides by 1 instead of by the real subtotal.
  const ratio = subtotal > 0 ? taxable / subtotal : 0;

  const taxAmount = items.reduce((sum, i) => {
    const lineTaxable = i.qty * i.rate * ratio;
    return sum + lineTaxable * (i.gstPercent / 100);
  }, 0);

  const beforeRound = taxable + taxAmount + shipping;
  const total = roundOff ? Math.round(beforeRound) : Math.round(beforeRound * 100) / 100;

  return {
    subtotal,
    discount,
    taxable,
    taxAmount,
    cgst: taxMode === "cgst-sgst" ? taxAmount / 2 : 0,
    sgst: taxMode === "cgst-sgst" ? taxAmount / 2 : 0,
    igst: taxMode === "igst" ? taxAmount : 0,
    total,
  };
}
