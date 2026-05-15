import { calculateContainerWeight, formatWeightValue } from './utils';

export const LEGACY_EQUIPPED_CONTAINER_NAME = 'Equipped';

export const EQUIPPED_CONTAINER_TYPES = {
  LEFT_HAND: 'left-hand',
  RIGHT_HAND: 'right-hand',
  ARMOR: 'armor',
  OTHER: 'other-equipped',
};

export const EQUIPPED_CONTAINER_DEFINITIONS = [
  {
    id: 'equipped-left-hand',
    equippedType: EQUIPPED_CONTAINER_TYPES.LEFT_HAND,
    name: 'Left Hand',
    singleItem: true,
  },
  {
    id: 'equipped-right-hand',
    equippedType: EQUIPPED_CONTAINER_TYPES.RIGHT_HAND,
    name: 'Right Hand',
    singleItem: true,
  },
  {
    id: 'equipped-armor',
    equippedType: EQUIPPED_CONTAINER_TYPES.ARMOR,
    name: 'Armor',
    singleItem: true,
  },
  {
    id: 'equipped-other',
    equippedType: EQUIPPED_CONTAINER_TYPES.OTHER,
    name: 'Other Equipped',
    singleItem: false,
  },
];

const EQUIPPED_TYPE_SET = new Set(
  EQUIPPED_CONTAINER_DEFINITIONS.map((definition) => definition.equippedType),
);

const EQUIPPED_ID_SET = new Set(
  EQUIPPED_CONTAINER_DEFINITIONS.map((definition) => definition.id),
);

export const isLegacyEquippedContainer = (container) =>
  (container?.name || '').trim().toLowerCase() ===
  LEGACY_EQUIPPED_CONTAINER_NAME.toLowerCase();

export const isProgrammaticEquippedContainer = (container) =>
  Boolean(container?.isEquipped) ||
  EQUIPPED_TYPE_SET.has(container?.equippedType) ||
  EQUIPPED_ID_SET.has(container?.id);

export const isEquippedContainer = (container) =>
  isProgrammaticEquippedContainer(container) || isLegacyEquippedContainer(container);

export const isSingleItemEquippedContainer = (container) =>
  isProgrammaticEquippedContainer(container) && Boolean(container?.singleItem);

export const getEquippedDefinition = (container) => {
  if (!container) return null;

  return EQUIPPED_CONTAINER_DEFINITIONS.find(
    (definition) =>
      definition.equippedType === container.equippedType ||
      definition.id === container.id,
  ) || null;
};

export const MOVEMENT_BANDS = [
  { speed: "120'", speedValue: 120, maxEquipped: 3, maxPacked: 10 },
  { speed: "90'", speedValue: 90, maxEquipped: 5, maxPacked: 12 },
  { speed: "60'", speedValue: 60, maxEquipped: 7, maxPacked: 14 },
  { speed: "30'", speedValue: 30, maxEquipped: 9, maxPacked: 16 },
];

const getBandIndexForEquipped = (equippedSlots) =>
  MOVEMENT_BANDS.findIndex((band) => equippedSlots <= band.maxEquipped);

const getBandIndexForPacked = (packedSlots, strengthModifier) =>
  MOVEMENT_BANDS.findIndex(
    (band) => packedSlots <= band.maxPacked + strengthModifier,
  );

const getMovementFromBandIndex = (bandIndex) => {
  if (bandIndex === -1) {
    return { speed: 'Overloaded', speedValue: 0 };
  }

  return {
    speed: MOVEMENT_BANDS[bandIndex].speed,
    speedValue: MOVEMENT_BANDS[bandIndex].speedValue,
  };
};

export const calculateEquippedSectionEncumbrance = (equippedSlots = 0) => ({
  slots: equippedSlots,
  ...getMovementFromBandIndex(getBandIndexForEquipped(equippedSlots)),
});

export const calculateStowedSectionEncumbrance = (packedSlots = 0, strengthModifier = 0) => ({
  slots: packedSlots,
  strengthModifier: Number(strengthModifier || 0),
  ...getMovementFromBandIndex(
    getBandIndexForPacked(packedSlots, Number(strengthModifier || 0)),
  ),
});

export const formatModifier = (modifier) => {
  const value = Number(modifier) || 0;
  return value >= 0 ? `+${value}` : String(value);
};

export const getItemSlots = (item) => Number(item?.weight || 0);

export const sanitizeDefaultContainers = (containers) => {
  const defaults = Array.isArray(containers) ? containers : [];
  return defaults
    .filter((container) => !isEquippedContainer(container))
    .map((container) => {
      const { isEquipped, equippedType, singleItem, ...stowedContainer } = container;
      return stowedContainer;
    });
};

const createEquippedContainer = (definition, items = []) => ({
  id: definition.id,
  name: definition.name,
  items,
  weight: 0,
  maxCapacity: 0,
  isEquipped: true,
  equippedType: definition.equippedType,
  singleItem: definition.singleItem,
});

const normalizeProgrammaticEquippedContainer = (container, definition, items = null) => ({
  ...container,
  id: definition.id,
  name: definition.name,
  items: items || container.items || [],
  weight: 0,
  maxCapacity: 0,
  isEquipped: true,
  equippedType: definition.equippedType,
  singleItem: definition.singleItem,
});

const containersEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const normalizeContainersForEquippedSections = (containers) => {
  const originalContainers = Array.isArray(containers) ? containers : [];
  const legacyEquippedContainers = originalContainers.filter(
    (container) => isLegacyEquippedContainer(container) && !isProgrammaticEquippedContainer(container),
  );
  const legacyEquippedItems = legacyEquippedContainers.flatMap(
    (container) => container.items || [],
  );

  const stowedContainers = originalContainers.filter(
    (container) =>
      !isProgrammaticEquippedContainer(container) &&
      !(isLegacyEquippedContainer(container) && !isProgrammaticEquippedContainer(container)),
  );

  const programmaticEquippedContainers = originalContainers.filter(isProgrammaticEquippedContainer);
  const overflowItems = [];

  const equippedContainers = EQUIPPED_CONTAINER_DEFINITIONS.map((definition) => {
    const matchingContainer =
      programmaticEquippedContainers.find(
        (container) => container.equippedType === definition.equippedType,
      ) ||
      programmaticEquippedContainers.find((container) => container.id === definition.id);

    const baseContainer = matchingContainer
      ? normalizeProgrammaticEquippedContainer(matchingContainer, definition)
      : createEquippedContainer(definition);

    if (definition.singleItem && (baseContainer.items || []).length > 1) {
      const [firstItem, ...extraItems] = baseContainer.items;
      overflowItems.push(...extraItems);
      return normalizeProgrammaticEquippedContainer(baseContainer, definition, [firstItem]);
    }

    return baseContainer;
  });

  const otherEquippedContainer = equippedContainers.find(
    (container) => container.equippedType === EQUIPPED_CONTAINER_TYPES.OTHER,
  );
  if (otherEquippedContainer) {
    otherEquippedContainer.items = [
      ...(otherEquippedContainer.items || []),
      ...legacyEquippedItems,
      ...overflowItems,
    ];
  }

  const normalizedContainers = [...equippedContainers, ...stowedContainers];
  return {
    containers: normalizedContainers,
    changed: !containersEqual(originalContainers, normalizedContainers),
  };
};

export const normalizeCharacterForEquippedSections = (character) => {
  const { containers, changed } = normalizeContainersForEquippedSections(character?.containers || []);
  return {
    character: {
      ...character,
      containers,
    },
    changed,
  };
};

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
  const equippedSection = calculateEquippedSectionEncumbrance(totals.equipped);
  const packedSection = calculateStowedSectionEncumbrance(totals.packed, strengthModifier);

  if (equippedBandIndex === -1 || packedBandIndex === -1) {
    return {
      ...totals,
      strengthModifier,
      equippedSpeed: equippedSection.speed,
      equippedSpeedValue: equippedSection.speedValue,
      packedSpeed: packedSection.speed,
      packedSpeedValue: packedSection.speedValue,
      stowedSpeed: packedSection.speed,
      stowedSpeedValue: packedSection.speedValue,
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
    equippedSpeed: equippedSection.speed,
    equippedSpeedValue: equippedSection.speedValue,
    packedSpeed: packedSection.speed,
    packedSpeedValue: packedSection.speedValue,
    stowedSpeed: packedSection.speed,
    stowedSpeedValue: packedSection.speedValue,
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
  return `${encumbrance.speed} · ${formatWeightValue(encumbrance.equipped + encumbrance.packed)} slots`;
};

export const splitEquippedAndStowedContainers = (containers) => {
  const normalized = normalizeContainersForEquippedSections(containers).containers;
  return {
    equippedContainers: normalized.filter(isProgrammaticEquippedContainer),
    stowedContainers: normalized.filter((container) => !isProgrammaticEquippedContainer(container)),
  };
};
