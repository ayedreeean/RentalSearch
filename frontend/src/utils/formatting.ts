/**
 * Formats a number as a US dollar currency string.
 * @param amount The number to format.
 * @returns The formatted currency string (e.g., "$1,234").
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Formats a number as a percentage string.
 * @param percent The number to format (e.g., 8.5 for 8.5%).
 * @returns The formatted percentage string (e.g., "8.5%").
 */
export const formatPercent = (percent: number): string => {
    // Ensure consistent formatting, e.g., one decimal place
    return `${percent.toFixed(1)}%`; 
}; 