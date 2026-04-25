/**
 * Coin utilities for OSRIC inventory management
 *
 * Coin denominations: platinum (p), gold (g), silver (s), copper (c)
 * Weight: configurable coins-per-weight-unit; default 50 (e.g. 50 coins = 1 lb).
 */

export const DEFAULT_COINS_PER_WEIGHT_UNIT = 50;

// Parse coin string like "123p 456g 789s 555c" into object
export function parseCoins(coinString) {
  const coins = { platinum: 0, gold: 0, silver: 0, copper: 0 };
  if (!coinString) return coins;

  const str = coinString.toLowerCase().trim();

  // Match patterns like "123p", "456g", "789s", "555c"
  const platinumMatch = str.match(/(\d+)\s*p(?:latinum)?/i);
  const goldMatch = str.match(/(\d+)\s*g(?:old)?/i);
  const silverMatch = str.match(/(\d+)\s*s(?:ilver)?/i);
  const copperMatch = str.match(/(\d+)\s*c(?:opper)?/i);

  if (platinumMatch) coins.platinum = parseInt(platinumMatch[1], 10);
  if (goldMatch) coins.gold = parseInt(goldMatch[1], 10);
  if (silverMatch) coins.silver = parseInt(silverMatch[1], 10);
  if (copperMatch) coins.copper = parseInt(copperMatch[1], 10);

  return coins;
}

// Format coins object into display string like "123p 456g 789s 555c"
export function formatCoins(coins) {
  if (!coins) return '';

  const parts = [];
  if (coins.platinum > 0) parts.push(`${coins.platinum}p`);
  if (coins.gold > 0) parts.push(`${coins.gold}g`);
  if (coins.silver > 0) parts.push(`${coins.silver}s`);
  if (coins.copper > 0) parts.push(`${coins.copper}c`);

  return parts.join(' ') || '0c';
}

// Calculate total number of coins
export function getTotalCoinCount(coins) {
  if (!coins) return 0;
  return (coins.platinum || 0) + (coins.gold || 0) + (coins.silver || 0) + (coins.copper || 0);
}

// Calculate weight of coins (rounded down). `ratio` is coins per weight unit.
export function calculateCoinWeight(coins, ratio = DEFAULT_COINS_PER_WEIGHT_UNIT) {
  const totalCoins = getTotalCoinCount(coins);
  return Math.floor(totalCoins / ratio);
}

// Merge two coin objects
export function mergeCoins(coins1, coins2) {
  return {
    platinum: (coins1?.platinum || 0) + (coins2?.platinum || 0),
    gold: (coins1?.gold || 0) + (coins2?.gold || 0),
    silver: (coins1?.silver || 0) + (coins2?.silver || 0),
    copper: (coins1?.copper || 0) + (coins2?.copper || 0),
  };
}

// Check if coins object has any coins
export function hasCoins(coins) {
  return getTotalCoinCount(coins) > 0;
}

// Parse treasure value from name like "sapphire (1000g)" or "Ruby (500gp)"
export function parseTreasureValue(name) {
  if (!name) return null;

  // Match patterns like "(1000g)", "(500gp)", "(1,000g)", "(1000 gold)"
  const match = name.match(/\((\d[\d,]*)\s*(?:gp?|gold)\)/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return null;
}

// Convert treasure gold value to coins
export function treasureToCoins(goldValue) {
  return {
    platinum: 0,
    gold: goldValue,
    silver: 0,
    copper: 0,
  };
}

// Check if item is a coin item
export function isCoinItem(item) {
  return item?.itemType === 'coins';
}

// Check if item is a treasure item
export function isTreasureItem(item) {
  return item?.itemType === 'treasure';
}

// Create a new coin item
export function createCoinItem(coins, id) {
  const weight = calculateCoinWeight(coins);
  return {
    id,
    name: `$ ${formatCoins(coins)}`,
    weight,
    description: '',
    itemType: 'coins',
    coins: { ...coins },
  };
}

// Create a new treasure item
export function createTreasureItem(name, goldValue, weight, description, id) {
  return {
    id,
    name,
    weight,
    description,
    itemType: 'treasure',
    goldValue,
  };
}

// Find coins item in a container
export function findCoinsInContainer(container) {
  return (container?.items || []).find(item => item.itemType === 'coins');
}

// Merge all coin items in a container into one
export function mergeContainerCoins(items) {
  const coinItems = items.filter(item => item.itemType === 'coins');
  const nonCoinItems = items.filter(item => item.itemType !== 'coins');

  if (coinItems.length <= 1) {
    return items; // Nothing to merge
  }

  // Merge all coins together
  let mergedCoins = { platinum: 0, gold: 0, silver: 0, copper: 0 };
  coinItems.forEach(item => {
    mergedCoins = mergeCoins(mergedCoins, item.coins);
  });

  // Create single merged coin item, keeping the first coin item's ID
  const mergedCoinItem = createCoinItem(mergedCoins, coinItems[0].id);

  return [...nonCoinItems, mergedCoinItem];
}
