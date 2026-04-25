import { useState, useEffect } from "react";
import { parseWeightInput } from "../../utils/utils";
import { calculateCoinWeight, formatCoins } from "../../utils/coins";
import { usePartyConfig } from "../../contexts/PartyConfigContext";

export const AddItemInputModal = ({ show, onClose, onSubmit }) => {
  const { weightUnit, coinsPerWeightUnit } = usePartyConfig();
  const [itemName, setItemName] = useState("");
  const [itemWeightString, setItemWeightString] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [isUnidentified, setIsUnidentified] = useState(false);
  const [secretName, setSecretName] = useState("");
  const [secretDescription, setSecretDescription] = useState("");

  // Item type: 'normal', 'coins', or 'treasure'
  const [itemType, setItemType] = useState('normal');

  // Coin denominations
  const [platinum, setPlatinum] = useState(0);
  const [gold, setGold] = useState(0);
  const [silver, setSilver] = useState(0);
  const [copper, setCopper] = useState(0);

  // Treasure gold value and quantity
  const [treasureValue, setTreasureValue] = useState(0);
  const [treasureQuantity, setTreasureQuantity] = useState(1);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        resetForm();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const handleSubmit = () => {
    // Handle coins
    if (itemType === 'coins') {
      const coins = {
        platinum: parseInt(platinum, 10) || 0,
        gold: parseInt(gold, 10) || 0,
        silver: parseInt(silver, 10) || 0,
        copper: parseInt(copper, 10) || 0,
      };
      const coinWeight = calculateCoinWeight(coins, coinsPerWeightUnit);
      const coinName = `$ ${formatCoins(coins)}`;
      onSubmit(coinName, coinWeight, '', {
        itemType: 'coins',
        coins,
      });
      resetForm();
      return;
    }

    // Handle treasure
    if (itemType === 'treasure') {
      const treasureGoldValue = parseInt(treasureValue, 10) || 0;
      const qty = parseInt(treasureQuantity, 10) || 1;
      const itemWeightPounds = itemWeightString.trim() === ""
        ? 0
        : parseWeightInput(itemWeightString);

      if (isNaN(itemWeightPounds)) {
        alert("Invalid weight format. Please enter a number (e.g., '5' or '0.5').");
        return;
      }

      // Build treasure name with quantity prefix and gold value suffix
      let baseName = itemName.trim();
      // Remove any existing quantity prefix or gold value suffix for clean rebuild
      baseName = baseName.replace(/^\d+x\s*/, '').replace(/\s*\(\d+g\)\s*$/, '').trim();

      let treasureName = qty > 1 ? `${qty}x ${baseName} (${treasureGoldValue}g)` : `${baseName} (${treasureGoldValue}g)`;

      // Total weight is per-item weight times quantity
      const totalWeight = itemWeightPounds * qty;

      onSubmit(treasureName, totalWeight, itemDescription, {
        itemType: 'treasure',
        goldValue: treasureGoldValue,
        quantity: qty,
        weightPerItem: itemWeightPounds,
      });
      resetForm();
      return;
    }

    // Handle normal items
    const itemWeightPounds = itemWeightString.trim() === ""
      ? 0
      : parseWeightInput(itemWeightString);

    if (!isNaN(itemWeightPounds)) {
      if (isUnidentified) {
        onSubmit(itemName, itemWeightPounds, itemDescription, {
          isUnidentified: true,
          secretName,
          secretDescription,
        });
      } else {
        onSubmit(itemName, itemWeightPounds, itemDescription);
      }
      resetForm();
    } else {
      alert(
        "Invalid weight format. Please enter a number (e.g., '5' or '0.5').",
      );
    }
  };

  const resetForm = () => {
    setItemName("");
    setItemWeightString("");
    setItemDescription("");
    setIsUnidentified(false);
    setSecretName("");
    setSecretDescription("");
    setItemType('normal');
    setPlatinum(0);
    setGold(0);
    setSilver(0);
    setCopper(0);
    setTreasureValue(0);
    setTreasureQuantity(1);
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          Add New Item
        </h3>

        {/* Item Type Selector */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setItemType('normal')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                itemType === 'normal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setItemType('coins')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                itemType === 'coins'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Coins
            </button>
            <button
              type="button"
              onClick={() => setItemType('treasure')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                itemType === 'treasure'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Treasure
            </button>
          </div>
        </div>

        {/* Coins Input */}
        {itemType === 'coins' && (
          <div className="border border-yellow-300 bg-yellow-50 rounded-md p-3 mb-3">
            <p className="text-sm text-yellow-700 font-medium mb-2">Coin Denominations</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600">Platinum (p)</label>
                <input
                  type="number"
                  min="0"
                  value={platinum}
                  onChange={(e) => setPlatinum(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Gold (g)</label>
                <input
                  type="number"
                  min="0"
                  value={gold}
                  onChange={(e) => setGold(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Silver (s)</label>
                <input
                  type="number"
                  min="0"
                  value={silver}
                  onChange={(e) => setSilver(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Copper (c)</label>
                <input
                  type="number"
                  min="0"
                  value={copper}
                  onChange={(e) => setCopper(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Weight: {calculateCoinWeight({ platinum: parseInt(platinum) || 0, gold: parseInt(gold) || 0, silver: parseInt(silver) || 0, copper: parseInt(copper) || 0 }, coinsPerWeightUnit)} {weightUnit.plural} ({coinsPerWeightUnit} coins = 1 {weightUnit.singular})
            </p>
          </div>
        )}

        {/* Treasure Input */}
        {itemType === 'treasure' && (
          <div className="border border-emerald-300 bg-emerald-50 rounded-md p-3 mb-3">
            <p className="text-sm text-emerald-700 font-medium mb-2">Treasure Details</p>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Treasure name (e.g., 'Sapphire')"
              className="w-full p-2 border border-gray-300 rounded-md mb-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex gap-2 mb-2">
              <div className="w-20">
                <label className="block text-xs text-gray-600">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={treasureQuantity}
                  onChange={(e) => setTreasureQuantity(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600">Gold Value (each)</label>
                <input
                  type="number"
                  min="0"
                  value={treasureValue}
                  onChange={(e) => setTreasureValue(e.target.value)}
                  placeholder="50"
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600">Weight (each)</label>
                <input
                  type="text"
                  value={itemWeightString}
                  onChange={(e) => setItemWeightString(e.target.value)}
                  placeholder="0.1"
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <textarea
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Description (optional)"
              rows="2"
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        )}

        {/* Normal Item Input */}
        {itemType === 'normal' && (
          <>
            {/* Unidentified checkbox */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isUnidentified}
                onChange={(e) => setIsUnidentified(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-gray-700 font-medium">Unidentified Item</span>
            </label>

            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={isUnidentified ? "Unidentified Name (e.g., 'Strange Ring')" : "Item Name"}
              className="w-full p-2 border border-gray-300 rounded-md mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={itemWeightString}
              onChange={(e) => setItemWeightString(e.target.value)}
              placeholder={`Weight in ${weightUnit.plural} (e.g., 5 or 0.5)`}
              className="w-full p-2 border border-gray-300 rounded-md mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {!isUnidentified && (
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Description (optional)"
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-md mb-4 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}

            {/* Secret fields for unidentified items */}
            {isUnidentified && (
              <div className="border-t border-gray-200 pt-3 mt-1">
                <p className="text-sm text-purple-600 font-medium mb-2">Secret Info (revealed when identified)</p>
                <input
                  type="text"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="Secret Name (e.g., 'Ring of Protection')"
                  className="w-full p-2 border border-purple-300 rounded-md mb-3 text-gray-900 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <textarea
                  value={secretDescription}
                  onChange={(e) => setSecretDescription(e.target.value)}
                  placeholder="Secret Description"
                  rows="3"
                  className="w-full p-2 border border-purple-300 rounded-md mb-4 text-gray-900 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              handleSubmit();
              onClose();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
