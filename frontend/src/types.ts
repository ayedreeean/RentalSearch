export interface Property {
  property_id: string;
  address: string;
  price: number;
  rent_estimate: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  thumbnail: string;
  url: string;
  ratio: number;
  days_on_market: number | null;
  rent_source?: "zillow" | "calculated";
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface Cashflow {
  monthlyMortgage: number;
  monthlyTaxInsurance: number;
  monthlyVacancy: number;
  monthlyCapex: number;
  monthlyPropertyManagement: number;
  totalMonthlyExpenses: number;
  monthlyCashflow: number;
  annualCashflow: number;
  cashOnCashReturn: number;
}

export interface CashflowSettings {
  interestRate: number;
  loanTerm: number;
  downPaymentPercent: number;
  taxInsurancePercent: number;
  vacancyPercent: number;
  capexPercent: number;
  propertyManagementPercent: number;
} 