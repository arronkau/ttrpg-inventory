// Weight utility functions for OSRIC inventory system
// Base unit: pounds (lbs)

/**
 * Format weight for display
 * @param {number} totalPounds - Weight in pounds
 * @returns {string} - Formatted weight string with "lbs" suffix
 */
export const formatWeight = (totalPounds) => {
  if (totalPounds === 0) {
    return "0 lbs";
  }

  // Round to 2 decimal places for display
  const rounded = Math.round(totalPounds * 100) / 100;

  // Use singular "lb" for 1, plural "lbs" otherwise
  const suffix = Math.abs(rounded) === 1 ? "lb" : "lbs";

  // Format nicely - remove unnecessary decimals
  const formatted = Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/\.?0+$/, '');

  return `${formatted} ${suffix}`;
};

/**
 * Legacy function name - now just calls formatWeight
 * Kept for backwards compatibility with existing code
 * @param {number} totalPounds - Weight in pounds
 * @returns {string} - Formatted weight string
 */
export const formatWeightInStones = (totalPounds) => {
  return formatWeight(totalPounds);
};

/**
 * Calculate total weight of items in a container
 * @param {object} container - Container with items array
 * @returns {number} - Total weight in pounds
 */
export const calculateContainerWeight = (container) => {
  return (container?.items || []).reduce(
    (total, item) => total + (item?.weight || 0) * (item?.quantity || 1),
    0,
  );
};

/**
 * Parse weight input string to pounds
 * Now expects direct pound values (e.g., "5" = 5 lbs)
 * @param {string} weightString - Weight input string
 * @returns {number} - Weight in pounds, or NaN if invalid
 */
export const parseWeightInput = (weightString) => {
  weightString = String(weightString).trim();
  if (!weightString) return NaN;

  // Remove "lbs" or "lb" suffix if present
  weightString = weightString.replace(/\s*(lbs?|pounds?)$/i, '').trim();

  // Parse as a simple number
  const value = parseFloat(weightString);

  if (isNaN(value)) return NaN;

  // Round to 2 decimal places
  return Math.round(value * 100) / 100;
};

