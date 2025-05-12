export interface Property {
  property_id: string;
  address: string;
  price: number;
  rent_estimate: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  thumbnail: string;
  photo_url?: string;
  url: string;
  ratio: number;
  days_on_market: number | null;
  rent_source?: "zillow" | "calculated";
  latitude?: number;
  longitude?: number;
  notes?: string;
  zpid?: string | number;
  description?: string;
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
  downPaymentAmount: number;
  closingCosts: number;
  rehabAmount: number;
  totalInitialInvestment: number;
}

export interface CashflowSettings {
  interestRate: number;
  loanTerm: number;
  downPaymentPercent: number;
  taxInsurancePercent: number;
  vacancyPercent: number;
  capexPercent: number;
  propertyManagementPercent: number;
  rehabAmount: number;
}

// Add the interface for long-term cashflow data
export interface YearlyProjection {
  year: number;
  propertyValue: number;
  annualRent: number;
  yearlyExpenses: number;
  yearlyCashflow: number;
  equity: number;
  equityGrowth: number;
  roi: number;
  roiWithEquity: number;
} 

// Define the structure stored in localStorage
// Export this interface so it can be imported elsewhere
export interface PortfolioAssumptionOverrides {
    interestRate?: number;
    loanTerm?: number;
    downPaymentPercent?: number;
    taxInsurancePercent?: number;
    vacancyPercent?: number;
    capexPercent?: number;
    propertyManagementPercent?: number;
    rehabAmount?: number;
    rentEstimate?: number;
    customRent?: number;
}