import { Property, Cashflow, CashflowSettings } from '../types';

/**
 * Calculates the monthly mortgage payment (Principal & Interest).
 * @param price The total price of the property.
 * @param settings The cashflow settings containing interest rate, loan term, and down payment %.
 * @returns The calculated monthly mortgage payment.
 */
export const calculateMortgage = (price: number, settings: Pick<CashflowSettings, 'interestRate' | 'loanTerm' | 'downPaymentPercent'>): number => {
    const downPayment = price * (settings.downPaymentPercent / 100);
    const loanAmount = price - downPayment;
    const monthlyRate = settings.interestRate / 100 / 12;
    const payments = settings.loanTerm * 12;

    if (loanAmount <= 0) return 0; // Handle 100% down payment or invalid price
    if (monthlyRate === 0) return loanAmount / payments; // Handle 0% interest
    if (payments === 0) return 0; // Handle 0-year loan term

    const x = Math.pow(1 + monthlyRate, payments);
    return loanAmount * (monthlyRate * x) / (x - 1);
};

/**
 * Calculates the detailed cashflow breakdown for a property based on given settings.
 * @param property The property object (must include price and rent_estimate).
 * @param settings The full cashflow settings object.
 * @returns A Cashflow object containing the detailed breakdown and results.
 */
export const calculateCashflow = (property: Pick<Property, 'price' | 'rent_estimate'>, settings: CashflowSettings): Cashflow => {
    const { price, rent_estimate } = property;
    const { 
        interestRate, 
        loanTerm, 
        downPaymentPercent, 
        taxInsurancePercent, 
        vacancyPercent, 
        capexPercent, 
        propertyManagementPercent, 
        rehabAmount // Include rehab amount
    } = settings;

    // Use calculateMortgage helper
    const monthlyMortgage = calculateMortgage(price, { interestRate, loanTerm, downPaymentPercent });

    // Calculate expenses based on settings
    const monthlyTaxInsurance = price * (taxInsurancePercent / 100) / 12;
    const monthlyVacancy = rent_estimate * (vacancyPercent / 100);
    const monthlyCapex = rent_estimate * (capexPercent / 100);
    const monthlyPropertyManagement = rent_estimate * (propertyManagementPercent / 100);

    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
    const monthlyCashflow = rent_estimate - totalMonthlyExpenses;
    const annualCashflow = monthlyCashflow * 12;

    // Calculate initial investment including rehab costs and typical closing costs (e.g., 3%)
    const downPaymentAmount = price * (downPaymentPercent / 100);
    const closingCosts = price * 0.03; // Estimate closing costs as 3% of price
    const totalInitialInvestment = downPaymentAmount + closingCosts + rehabAmount;

    // Calculate Cash-on-Cash Return
    const cashOnCashReturn = totalInitialInvestment > 0 ? (annualCashflow / totalInitialInvestment) * 100 : 0;

    return {
        monthlyMortgage,
        monthlyTaxInsurance,
        monthlyVacancy,
        monthlyCapex,
        monthlyPropertyManagement,
        totalMonthlyExpenses,
        monthlyCashflow,
        annualCashflow,
        cashOnCashReturn,
        // Include initial investment components in the return object
        downPaymentAmount,
        closingCosts,
        rehabAmount,
        totalInitialInvestment 
    };
}; 