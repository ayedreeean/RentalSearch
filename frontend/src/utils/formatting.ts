/**
 * Formats a number as a US Dollar currency string (e.g., $1,234).
 * 
 * @param amount The number to format.
 * @returns The formatted currency string.
 */
export const formatCurrency = (amount: number): string => {
  // Handle potential non-numeric input gracefully
  if (isNaN(amount) || amount === null) {
    return '$0'; // Or perhaps return an empty string or a placeholder?
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Formats a number as a percentage string (e.g., 12.34%).
 * Assumes the input is a percentage value (e.g., 12.34 for 12.34%).
 * 
 * @param percent The percentage value to format.
 * @returns The formatted percentage string.
 */
export const formatPercent = (percent: number): string => {
  // Handle potential non-numeric input gracefully
  if (isNaN(percent) || percent === null) {
    return '0.00%'; // Or placeholder
  }
  return `${percent.toFixed(2)}%`;
}; 