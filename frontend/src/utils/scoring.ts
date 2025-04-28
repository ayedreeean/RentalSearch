import { Property, CashflowSettings, Cashflow } from '../types';

/**
 * Normalizes Cash-on-Cash Return to a 0-100 scale.
 * Target range: 0% to 15%+ CoC.
 * 15%+ CoC gets 100 points. Negative CoC gets 0.
 */
const normalizeCoC = (coc: number): number => {
  // CoC is already a ratio (e.g., 0.1 for 10%), target is 15% (0.15)
  if (coc <= 0) return 0;
  return Math.min(100, (coc / 0.15) * 100);
};

/**
 * Normalizes the ratio of Monthly Cash Flow to Monthly Rent Estimate.
 * Target range: -10% to +20% of rent.
 * +20% or more gets 100 points. -10% or less gets 0.
 */
const normalizeCashflowToRent = (monthlyCashflow: number, rentEstimate: number): number => {
  if (rentEstimate <= 0) return 0; // Avoid division by zero, low score if no rent
  const ratio = monthlyCashflow / rentEstimate;
  const minRatio = -0.10;
  const maxRatio = 0.20;
  if (ratio <= minRatio) return 0;
  if (ratio >= maxRatio) return 100;
  return ((ratio - minRatio) / (maxRatio - minRatio)) * 100;
};

/**
 * Normalizes Rent-to-Price Ratio.
 * Target range: 0.4% to 1.0%+ ratio.
 * 1.0%+ gets 100 points. 0.4% or less gets 0.
 */
const normalizeRentToPriceRatio = (ratio: number): number => {
  const minRatio = 0.004; // 0.4%
  const maxRatio = 0.010; // 1.0%
  if (ratio <= minRatio) return 0;
  if (ratio >= maxRatio) return 100;
  return ((ratio - minRatio) / (maxRatio - minRatio)) * 100;
};

/**
 * Normalizes Down Payment percentage. Favors higher DP slightly (lower risk).
 * Target range: 20% to 50%.
 * 50%+ gets 100 points. <20% gets 0.
 */
const normalizeDownPayment = (downPaymentPercent: number): number => {
  const minDP = 20;
  const maxDP = 50;
  if (downPaymentPercent <= minDP) return 0; // Or slightly penalize sub-20%? For now, 0.
  if (downPaymentPercent >= maxDP) return 100;
  return ((downPaymentPercent - minDP) / (maxDP - minDP)) * 100;
};

/**
 * Normalizes Days On Market. Favors lower DOM.
 * Target range: 90 days down to 0 days. Treats null as average (30 days).
 * 0 days gets 100 points. 90+ days gets 0.
 */
const normalizeDaysOnMarket = (daysOnMarket: number | null): number => {
  const dom = daysOnMarket ?? 30; // Assume 30 days if null
  const minDOM = 0;
  const maxDOM = 90;
  if (dom <= minDOM) return 100;
  if (dom >= maxDOM) return 0;
  // Linear scale, inverted (lower is better)
  return ((maxDOM - dom) / (maxDOM - minDOM)) * 100;
};

/**
 * Normalizes Rehab Costs as a percentage of Price. Favors lower rehab.
 * Target range: 20% down to 0% of price.
 * 0% gets 100 points. 20%+ gets 0.
 */
const normalizeRehabCost = (rehabAmount: number, price: number): number => {
  if (price <= 0) return 0; // Cannot calculate percentage if price is zero or negative
  const rehabPercent = rehabAmount / price;
  const minRehab = 0;
  const maxRehab = 0.20; // 20%
  if (rehabPercent <= minRehab) return 100;
  if (rehabPercent >= maxRehab) return 0;
  // Linear scale, inverted (lower is better)
  return ((maxRehab - rehabPercent) / (maxRehab - minRehab)) * 100;
};


/**
 * Calculates the "Crunch Score" based on property data, cashflow, and user settings.
 * The score is a weighted average of normalized metrics representing investment potential.
 *
 * @param property - The property data.
 * @param settings - The user's current cashflow assumptions.
 * @param cashflow - The calculated cashflow details for the property using the settings.
 * @returns A score between 0 and 100 (rounded).
 */
export const calculateCrunchScore = (
  property: Property,
  settings: CashflowSettings,
  cashflow: Cashflow
): number => {

  // Handle potential division by zero or invalid inputs gracefully
  if (!property || property.price <= 0) {
      return 0;
  }

  const normCoC = normalizeCoC(cashflow.cashOnCashReturn);
  const normCF_Rent = normalizeCashflowToRent(cashflow.monthlyCashflow, property.rent_estimate);
  const normRatio = normalizeRentToPriceRatio(property.ratio);
  const normDP = normalizeDownPayment(settings.downPaymentPercent);
  const normDOM = normalizeDaysOnMarket(property.days_on_market);
  const normRehab = normalizeRehabCost(settings.rehabAmount, property.price);

  const score =
    (normCoC * 0.35) +       // Weight: 35%
    (normCF_Rent * 0.25) +   // Weight: 25%
    (normRatio * 0.20) +     // Weight: 20%
    (normDP * 0.05) +        // Weight: 5%
    (normDOM * 0.05) +       // Weight: 5%
    (normRehab * 0.10);      // Weight: 10%

  // Clamp score between 0 and 100 and round
  return Math.round(Math.max(0, Math.min(100, score)));
}; 