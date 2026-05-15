import { calculateContainerWeight, formatWeightValue } from './utils';

export const EQUIPPED_CONTAINER_NAME = 'Equipped';

export const isEquippedContainer = (container) =>
  (container?.name || '').trim().toLowerCase() === EQUIPPED_CONTAINER_NAME.toLowerCase();

const MOVEMENT_BANDS = [
  { speed: "120’ (40’)", speedValue: 120, maxEquipped: 3, maxPacked: 10 },
  { speed: "90’ (30’)", speedValue: 90, maxEquipped: 5, maxPacked: 12 },
  { speed: "60’ (20’)", speedValue: 60, maxEquipped: 7, maxPacked: 14 },
  { speed: "30’ (10’)", speedValue: 30, maxEquipped: 9, maxPacked: 16 },
];

const getBandIndexForEquipped = (equippedSlots) =>
  MOVEMENT_BANDS.findIndex((band) => equippedSlots <= band.maxEquipped);

const getBandIndexForPacked = (packedSlots, strengthModifier) =>
  MOVEMENT_BANDS.findIndex(
    (band) => packedSlots <= band.maxPacked + strengthModifier,
  );

export const formatModifier = (modifier) => {
  const value = Number(modifier) || 0;
  return value >= 0 ? `+${value}` : String(value);
};

export const getItemSlots = (item) => Number(item?.weight || 0);

export const calculateCharacterEncumbrance = (character) => {
  const strengthModifier = Number(character?.strengthModifier || 0);

  const totals = (character?.containers || []).reduce(
    (acc, container) => {
      const containerSlots = calculateContainerWeight(container);
      if (isEquippedContainer(container)) {
        acc.equipped += containerSlots;
      } else {
        acc.packed += containerSlots;
      }
      return acc;
    },
    { equipped: 0, packed: 0 },
  );

  const equippedBandIndex = getBandIndexForEquipped(totals.equipped);
  const packedBandIndex = getBandIndexForPacked(totals.packed, strengthModifier);

  if (equippedBandIndex === -1 || packedBandIndex === -1) {
    return {
      ...totals,
      strengthModifier,
      speed: 'Overloaded',
      speedValue: 0,
      limitingFactor:
        equippedBandIndex === -1 && packedBandIndex === -1
          ? 'equipped and packed'
          : equippedBandIndex === -1
            ? 'equipped'
            : 'packed',
    };
  }

  const limitingBandIndex = Math.max(equippedBandIndex, packedBandIndex);
  const limitingBand = MOVEMENT_BANDS[limitingBandIndex];

  return {
    ...totals,
    strengthModifier,
    speed: limitingBand.speed,
    speedValue: limitingBand.speedValue,
    limitingFactor:
      equippedBandIndex === packedBandIndex
        ? 'equipped and packed'
        : equippedBandIndex > packedBandIndex
          ? 'equipped'
          : 'packed',
  };
};

export const summarizeCharacterEncumbrance = (character) => {
  const encumbrance = calculateCharacterEncumbrance(character);
  return `Speed ${encumbrance.speed} · Eq ${formatWeightValue(encumbrance.equipped)} · Pack ${formatWeightValue(encumbrance.packed)} · STR ${formatModifier(encumbrance.strengthModifier)}`;
};

export const ensureEquippedDefaultContainer = (containers) => {
  const defaults = Array.isArray(containers) ? containers : [];
  const hasEquipped = defaults.some(isEquippedContainer);
  if (hasEquipped) return defaults;

  return [
    { name: EQUIPPED_CONTAINER_NAME, weight: 0, maxCapacity: 9 },
    ...defaults,
  ];
};
