import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_DOWN });

export function calculateYield(
  principal: string,
  ratePercent: string,
  periods: number,
): string {
  const p = new Decimal(principal);
  const r = new Decimal(ratePercent).div(100);
  const result = p.mul(r).mul(periods);
  return result.toFixed(7); // match Soroban 7 decimal fixed-point
}

export function compoundYield(
  principal: string,
  ratePercent: string,
  periods: number,
): string {
  const p = new Decimal(principal);
  const r = new Decimal(ratePercent).div(100).plus(1);
  const result = p.mul(r.pow(periods)).minus(p);
  return result.toFixed(7);
}

export function sumDecimals(values: string[]): string {
  return values
    .reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0))
    .toFixed(7);
}