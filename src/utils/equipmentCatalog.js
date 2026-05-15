import equipmentData from "../data/ose_adventuring_gear_equipment.json";

export const EQUIPMENT_CATALOG = Array.isArray(equipmentData?.items)
  ? equipmentData.items
      .filter((item) => item?.name)
      .map((item) => ({
        name: item.name,
        slots: Number(item.slots ?? 1),
        description: item.description || "",
        priceGp: item.price_gp,
        type: item.type || "equipment",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  : [];

export const findEquipmentByName = (name) => {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return null;
  return EQUIPMENT_CATALOG.find((item) => item.name.toLowerCase() === normalized) || null;
};

export const getEquipmentSuggestions = (query, limit = 8) => {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return [];

  const startsWith = [];
  const includes = [];

  for (const item of EQUIPMENT_CATALOG) {
    const itemName = item.name.toLowerCase();
    if (itemName.startsWith(normalized)) startsWith.push(item);
    else if (itemName.includes(normalized)) includes.push(item);
    if (startsWith.length >= limit) break;
  }

  return [...startsWith, ...includes].slice(0, limit);
};
