import { createContext, useContext } from 'react';
import { formatWeight, DEFAULT_WEIGHT_UNIT } from '../utils/utils';

export const DEFAULT_PARTY_CONFIG = {
  weightUnit: DEFAULT_WEIGHT_UNIT,
  coinsPerWeightUnit: 100,
  defaultContainers: [
    { name: 'Equipped', weight: 0, maxCapacity: 10 },
    { name: 'Backpack', weight: 0, maxCapacity: 10 },
  ],
};

export const PartyConfigContext = createContext(DEFAULT_PARTY_CONFIG);

export function usePartyConfig() {
  return useContext(PartyConfigContext);
}

export function useFormatWeight() {
  const { weightUnit } = useContext(PartyConfigContext);
  return (totalPounds) => formatWeight(totalPounds, weightUnit);
}
