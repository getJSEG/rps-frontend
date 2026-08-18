function roundMoney2(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

export type CouponOfferFields = {
  code?: string | null;
  coupon_code?: string | null;
  discountType?: string | null;
  discountValue?: number | string | null;
  coupon_discount_type?: string | null;
  coupon_discount_value?: number | string | null;
};

/** Inner offer text: `AZADI - 25%` or `AZADI - $40`. Falls back to the code alone. */
export function couponOfferLabel(coupon: CouponOfferFields | null | undefined): string {
  const code = String(coupon?.code || coupon?.coupon_code || "").trim();
  if (!code) return "";
  const type = String(coupon?.discountType || coupon?.coupon_discount_type || "").toLowerCase();
  const value = Number(coupon?.discountValue ?? coupon?.coupon_discount_value);
  if (!Number.isFinite(value) || value <= 0) return code;
  if (type === "percent") {
    const pct = Number.isInteger(value) ? String(value) : String(roundMoney2(value));
    return `${code} - ${pct}%`;
  }
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${code} - $${amount}`;
}

/** Totals-row label: `Coupon (AZADI - 25%)`. */
export function couponLineLabel(coupon: CouponOfferFields | null | undefined): string {
  const inner = couponOfferLabel(coupon);
  return inner ? `Coupon (${inner})` : "Coupon";
}
