// Encumbrance utility functions.
// The stored numeric field is still named `weight` for backwards compatibility,
// but this fork treats it as an item-slot count by default.

export const DEFAULT_WEIGHT_UNIT = { singular: 'slot', plural: 'slots' };

/**
 * Format an encumbrance value for display.
 * @param {number} total - Slot count or other configured unit value.
 * @param {{singular: string, plural: string}} [unit=DEFAULT_WEIGHT_UNIT]
 * @returns {string}
 */
export const formatWeightValue = (total) => {
  const rounded = Math.round((total || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
};

export const formatWeight = (total, unit = DEFAULT_WEIGHT_UNIT) => {
  const rounded = Math.round((total || 0) * 100) / 100;
  const value = formatWeightValue(total);
  const suffix = Math.abs(rounded) === 1 ? unit.singular : unit.plural;
  return `${value} ${suffix}`;
};

/**
 * Calculate total item slots in a container.
 * Item `weight` values are treated as already-total slot counts. This avoids
 * double-counting treasure, where `weight` is stored as quantity × slots each.
 * @param {object} container - Container with items array
 * @returns {number} - Total item slots
 */
export const calculateContainerWeight = (container) => {
  return (container?.items || []).reduce(
    (total, item) => total + (Number(item?.weight) || 0),
    0,
  );
};

/**
 * Parse a slot/unit input string.
 * Accepts direct numeric values and ignores common legacy suffixes.
 * @param {string} weightString - Encumbrance input string
 * @returns {number} - Encumbrance value, or NaN if invalid
 */
export const parseWeightInput = (weightString) => {
  weightString = String(weightString).trim();
  if (!weightString) return NaN;

  // Remove common unit suffixes if present.
  weightString = weightString.replace(/\s*(lbs?|pounds?|slots?|items?)$/i, '').trim();

  const value = parseFloat(weightString);

  if (isNaN(value)) return NaN;

  return Math.round(value * 100) / 100;
};
