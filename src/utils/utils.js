// Weight utility functions for OSRIC inventory system
// Base unit: pounds (lbs)

export const DEFAULT_WEIGHT_UNIT = { singular: 'lb', plural: 'lbs' };

/**
 * Format weight for display
 * @param {number} totalPounds - Weight in pounds (or whatever the configured unit measures)
 * @param {{singular: string, plural: string}} [unit=DEFAULT_WEIGHT_UNIT]
 * @returns {string}
 */
export const formatWeightValue = (totalPounds) => {
  const rounded = Math.round((totalPounds || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
};

export const formatWeight = (totalPounds, unit = DEFAULT_WEIGHT_UNIT) => {
  const rounded = Math.round((totalPounds || 0) * 100) / 100;
  const value = formatWeightValue(totalPounds);
  const suffix = Math.abs(rounded) === 1 ? unit.singular : unit.plural;
  return `${value} ${suffix}`;
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

