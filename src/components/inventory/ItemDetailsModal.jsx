import { useState, useEffect } from "react";

import { parseWeightInput } from "../../utils/utils";
import { formatCoins, calculateCoinWeight } from "../../utils/coins";
import { LinkifiedText } from "../../utils/linkify";
import { useFormatWeight, usePartyConfig } from "../../contexts/PartyConfigContext";

export const ItemDetailsModal = ({
  handleDelete,
  show,
  onClose,
  item,
  onSaveDescription,
  onSaveCoinItem,
  onSaveItem,
  onLiquidateTreasure,
  characters,
  currentCharId,
  currentContainerId,
  onTransfer,
  onIdentify,
}) => {
  const formatWeight = useFormatWeight();
  const { weightUnit, coinsPerWeightUnit } = usePartyConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(
    item ? item.description || "" : "",
  );
  const [editedWeightString, setEditedWeightString] = useState(
    item ? String(item.weight || 0) : "",
  );
  const [editedName, setEditedName] = useState(item ? item.name : "");

  // Coin editing state
  const [editedPlatinum, setEditedPlatinum] = useState(0);
  const [editedGold, setEditedGold] = useState(0);
  const [editedSilver, setEditedSilver] = useState(0);
  const [editedCopper, setEditedCopper] = useState(0);

  // Item type editing state
  const [editedItemType, setEditedItemType] = useState('normal');
  const [editedGoldValue, setEditedGoldValue] = useState(0);
  const [editedQuantity, setEditedQuantity] = useState(1);
  const [editedWeightPerItem, setEditedWeightPerItem] = useState(0);

  // Liquidation state
  const [liquidateQty, setLiquidateQty] = useState(1);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [targetContainers, setTargetContainers] = useState([]);

  // Partial transfer state for coins
  const [transferPlatinum, setTransferPlatinum] = useState(0);
  const [transferGold, setTransferGold] = useState(0);
  const [transferSilver, setTransferSilver] = useState(0);
  const [transferCopper, setTransferCopper] = useState(0);

  // Partial transfer state for treasures
  const [transferQuantity, setTransferQuantity] = useState(1);

  // Reset all editing state when a different item is selected or modal opens fresh.
  // Keyed on item identity (id), not item reference, so Firebase updates to other
  // items don't clobber in-progress edits.
  const itemId = item?.id;
  useEffect(() => {
    setEditedDescription(item ? item.description || "" : "");
    setEditedName(item ? item.name : "");
    setEditedWeightString(item ? String(item.weight || 0) : "");
    setIsEditing(false);
    setShowTransfer(false);
    setSelectedCharacterId('');
    setSelectedContainerId('');

    // Reset item type editing state
    setEditedItemType(item?.itemType || 'normal');
    setEditedGoldValue(item?.goldValue || 0);
    setEditedQuantity(item?.quantity || 1);
    setEditedWeightPerItem(item?.weightPerItem || item?.weight || 0);
    setLiquidateQty(1);

    // Reset coin editing state
    if (item?.itemType === 'coins' && item.coins) {
      setEditedPlatinum(item.coins.platinum || 0);
      setEditedGold(item.coins.gold || 0);
      setEditedSilver(item.coins.silver || 0);
      setEditedCopper(item.coins.copper || 0);
    } else {
      setEditedPlatinum(0);
      setEditedGold(0);
      setEditedSilver(0);
      setEditedCopper(0);
    }

    // Reset partial transfer state
    setTransferPlatinum(0);
    setTransferGold(0);
    setTransferSilver(0);
    setTransferCopper(0);
    setTransferQuantity(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, show]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  // Cascading dropdown effect - update containers when character changes
  useEffect(() => {
    if (selectedCharacterId && characters) {
      const char = characters.find(c => c.id === selectedCharacterId);
      const containers = char?.containers || [];
      setTargetContainers(containers);
      // Auto-select first container, but exclude current container if same character
      const availableContainers = selectedCharacterId === currentCharId
        ? containers.filter(c => c.id !== currentContainerId)
        : containers;
      if (availableContainers.length > 0) {
        setSelectedContainerId(availableContainers[0].id);
      } else {
        setSelectedContainerId('');
      }
    } else {
      setTargetContainers([]);
      setSelectedContainerId('');
    }
  }, [selectedCharacterId, characters, currentCharId, currentContainerId]);

  const handleTransfer = () => {
    if (selectedCharacterId && selectedContainerId && onTransfer) {
      // Build partial transfer data for coins
      if (isCoins && item.coins) {
        const partialCoins = {
          platinum: Math.min(parseInt(transferPlatinum, 10) || 0, item.coins.platinum || 0),
          gold: Math.min(parseInt(transferGold, 10) || 0, item.coins.gold || 0),
          silver: Math.min(parseInt(transferSilver, 10) || 0, item.coins.silver || 0),
          copper: Math.min(parseInt(transferCopper, 10) || 0, item.coins.copper || 0),
        };
        const totalToTransfer = partialCoins.platinum + partialCoins.gold + partialCoins.silver + partialCoins.copper;
        if (totalToTransfer > 0) {
          onTransfer(selectedCharacterId, selectedContainerId, { type: 'coins', coins: partialCoins });
        }
      }
      // Build partial transfer data for treasures
      else if (isTreasure && (item.quantity || 1) > 1) {
        const qty = Math.min(Math.max(1, parseInt(transferQuantity, 10) || 1), item.quantity || 1);
        onTransfer(selectedCharacterId, selectedContainerId, { type: 'treasure', quantity: qty });
      }
      // Full transfer for normal items or full coin/treasure transfer
      else {
        onTransfer(selectedCharacterId, selectedContainerId);
      }
      onClose();
    }
  };

  const handleIdentify = () => {
    if (onIdentify) {
      onIdentify();
      onClose();
    }
  };

  if (!show || !item) return null;

  const handleSave = () => {
    // Check if type changed - use the full save handler
    const typeChanged = editedItemType !== (item.itemType || 'normal');

    if (typeChanged && onSaveItem) {
      // Build the updated item based on new type
      if (editedItemType === 'coins') {
        const coins = {
          platinum: parseInt(editedPlatinum, 10) || 0,
          gold: parseInt(editedGold, 10) || 0,
          silver: parseInt(editedSilver, 10) || 0,
          copper: parseInt(editedCopper, 10) || 0,
        };
        const totalCoins = coins.platinum + coins.gold + coins.silver + coins.copper;
        const coinWeight = Math.floor(totalCoins / coinsPerWeightUnit);
        const parts = [];
        if (coins.platinum > 0) parts.push(`${coins.platinum}p`);
        if (coins.gold > 0) parts.push(`${coins.gold}g`);
        if (coins.silver > 0) parts.push(`${coins.silver}s`);
        if (coins.copper > 0) parts.push(`${coins.copper}c`);
        const coinName = `$ ${parts.join(' ') || '0c'}`;

        onSaveItem(item.id, {
          name: coinName,
          weight: coinWeight,
          description: '',
          itemType: 'coins',
          coins,
        });
      } else if (editedItemType === 'treasure') {
        const qty = parseInt(editedQuantity, 10) || 1;
        const goldValue = parseInt(editedGoldValue, 10) || 0;
        const weightPerItem = parseFloat(editedWeightPerItem) || 0;
        const totalWeight = weightPerItem * qty;

        // Build treasure name with quantity prefix and gold value suffix
        let baseName = editedName.trim();
        baseName = baseName.replace(/^\d+x\s*/, '').replace(/\s*\(\d+g\)\s*$/, '').trim();
        const treasureName = qty > 1 ? `${qty}x ${baseName} (${goldValue}g)` : `${baseName} (${goldValue}g)`;

        onSaveItem(item.id, {
          name: treasureName,
          weight: totalWeight,
          description: editedDescription,
          itemType: 'treasure',
          goldValue,
          quantity: qty,
          weightPerItem,
        });
      } else {
        // Normal item
        const parsedWeight = parseWeightInput(editedWeightString);
        if (isNaN(parsedWeight)) {
          alert("Invalid weight format. Please enter a number (e.g., '5' or '0.5').");
          return;
        }
        onSaveItem(item.id, {
          name: editedName,
          weight: parsedWeight,
          description: editedDescription,
          itemType: undefined, // Remove type
        });
      }
      setIsEditing(false);
      return;
    }

    // Handle coin items (no type change)
    if (editedItemType === 'coins' && onSaveCoinItem) {
      const coins = {
        platinum: parseInt(editedPlatinum, 10) || 0,
        gold: parseInt(editedGold, 10) || 0,
        silver: parseInt(editedSilver, 10) || 0,
        copper: parseInt(editedCopper, 10) || 0,
      };
      onSaveCoinItem(item.id, coins);
      setIsEditing(false);
      return;
    }

    // Handle treasure items (no type change) - update gold value, quantity, and weight
    if (editedItemType === 'treasure' && onSaveItem) {
      const qty = parseInt(editedQuantity, 10) || 1;
      const goldValue = parseInt(editedGoldValue, 10) || 0;
      const weightPerItem = parseFloat(editedWeightPerItem) || 0;
      const totalWeight = weightPerItem * qty;

      // Build treasure name with quantity prefix and gold value suffix
      let baseName = editedName.trim();
      baseName = baseName.replace(/^\d+x\s*/, '').replace(/\s*\(\d+g\)\s*$/, '').trim();
      const treasureName = qty > 1 ? `${qty}x ${baseName} (${goldValue}g)` : `${baseName} (${goldValue}g)`;

      onSaveItem(item.id, {
        name: treasureName,
        weight: totalWeight,
        description: editedDescription,
        itemType: 'treasure',
        goldValue,
        quantity: qty,
        weightPerItem,
      });
      setIsEditing(false);
      return;
    }

    // Normal items
    const parsedWeight = parseWeightInput(editedWeightString);
    if (isNaN(parsedWeight)) {
      alert(
        "Invalid weight format. Please enter a number (e.g., '5' or '0.5').",
      );
      return;
    }
    onSaveDescription(item.id, editedName, parsedWeight, editedDescription);
    setIsEditing(false);
  };

  const handleLiquidate = () => {
    if (item.itemType === 'treasure' && item.goldValue && onLiquidateTreasure) {
      const qty = Math.min(liquidateQty, item.quantity || 1);
      const totalGold = item.goldValue * qty;
      onLiquidateTreasure(item.id, totalGold, qty);
      onClose();
    }
  };

  const isUnidentified = item.isUnidentified;
  const isCoins = item.itemType === 'coins';
  const isTreasure = item.itemType === 'treasure';

  // When editing, use the edited type for display logic
  const displayType = isEditing ? editedItemType : (item.itemType || 'normal');
  const displayIsCoins = displayType === 'coins';
  const displayIsTreasure = displayType === 'treasure';

  // Calculate weight preview for coin editing
  const editedCoinWeight = isEditing && displayIsCoins
    ? calculateCoinWeight({
        platinum: parseInt(editedPlatinum, 10) || 0,
        gold: parseInt(editedGold, 10) || 0,
        silver: parseInt(editedSilver, 10) || 0,
        copper: parseInt(editedCopper, 10) || 0,
      }, coinsPerWeightUnit)
    : 0;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl p-6 max-w-lg w-full text-gray-900 ${
        isUnidentified ? 'border-4 border-purple-500' :
        isCoins ? 'border-4 border-yellow-500' :
        isTreasure ? 'border-4 border-emerald-500' : ''
      }`}>
        {/* Item type badges */}
        {isUnidentified && (
          <div className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full mb-3 inline-block">
            ? Unidentified
          </div>
        )}
        {isCoins && (
          <div className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full mb-3 inline-block">
            Coins
          </div>
        )}
        {isTreasure && (
          <div className="bg-emerald-100 text-emerald-800 text-sm font-medium px-3 py-1 rounded-full mb-3 inline-block">
            Treasure ({item.goldValue}g)
          </div>
        )}

        {/* Item Type Selector (only when editing) */}
        {isEditing && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditedItemType('normal')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  editedItemType === 'normal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setEditedItemType('coins')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  editedItemType === 'coins'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Coins
              </button>
              <button
                type="button"
                onClick={() => setEditedItemType('treasure')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  editedItemType === 'treasure'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Treasure
              </button>
            </div>
          </div>
        )}

        {/* Title - different display for coins */}
        {displayIsCoins ? (
          <h3 className="text-2xl font-bold mb-4 border-b pb-2 text-yellow-600">
            {isEditing ? 'Edit Coins' : item.name}
          </h3>
        ) : isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            placeholder="Name of the item"
            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />
        ) : (
          <h3 className={`text-2xl font-bold mb-4 border-b pb-2 ${
            isUnidentified ? 'text-purple-600' :
            isTreasure ? 'text-emerald-600' : 'text-blue-600'
          }`}>
            {item.name}
          </h3>
        )}

        {/* Coin editing section */}
        {displayIsCoins && isEditing && (
          <div className="border border-yellow-300 bg-yellow-50 rounded-md p-3 mb-3">
            <p className="text-sm text-yellow-700 font-medium mb-2">Coin Denominations</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600">Platinum (p)</label>
                <input
                  type="number"
                  min="0"
                  value={editedPlatinum}
                  onChange={(e) => setEditedPlatinum(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Gold (g)</label>
                <input
                  type="number"
                  min="0"
                  value={editedGold}
                  onChange={(e) => setEditedGold(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Silver (s)</label>
                <input
                  type="number"
                  min="0"
                  value={editedSilver}
                  onChange={(e) => setEditedSilver(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Copper (c)</label>
                <input
                  type="number"
                  min="0"
                  value={editedCopper}
                  onChange={(e) => setEditedCopper(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Weight: {editedCoinWeight} {weightUnit.plural} ({coinsPerWeightUnit} coins = 1 {weightUnit.singular})
            </p>
          </div>
        )}

        {/* Treasure editing section - gold value input */}
        {displayIsTreasure && isEditing && (
          <div className="border border-emerald-300 bg-emerald-50 rounded-md p-3 mb-3">
            <p className="text-sm text-emerald-700 font-medium mb-2">Treasure Details</p>
            <div className="flex gap-2">
              <div className="w-20">
                <label className="block text-xs text-gray-600">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={editedQuantity}
                  onChange={(e) => setEditedQuantity(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600">Gold Value (each)</label>
                <input
                  type="number"
                  min="0"
                  value={editedGoldValue}
                  onChange={(e) => setEditedGoldValue(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600">Weight (each)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editedWeightPerItem}
                  onChange={(e) => setEditedWeightPerItem(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Coin display (non-editing) */}
        {isCoins && !isEditing && item.coins && (
          <div className="border border-yellow-300 bg-yellow-50 rounded-md p-3 mb-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {item.coins.platinum > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Platinum:</span>
                  <span className="font-medium">{item.coins.platinum}</span>
                </div>
              )}
              {item.coins.gold > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gold:</span>
                  <span className="font-medium">{item.coins.gold}</span>
                </div>
              )}
              {item.coins.silver > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Silver:</span>
                  <span className="font-medium">{item.coins.silver}</span>
                </div>
              )}
              {item.coins.copper > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Copper:</span>
                  <span className="font-medium">{item.coins.copper}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Total: {(item.coins.platinum || 0) + (item.coins.gold || 0) + (item.coins.silver || 0) + (item.coins.copper || 0)} coins
            </p>
          </div>
        )}

        {/* Weight display - skip for coins when editing */}
        {!(displayIsCoins && isEditing) && (
          <p className="text-lg font-medium mb-3">
            Weight:{" "}
            {isEditing && !displayIsCoins ? (
              <input
                type="text"
                value={editedWeightString}
                onChange={(e) => setEditedWeightString(e.target.value)}
                placeholder={`Weight in ${weightUnit.plural}`}
                className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <span className="text-yellow-700">
                {formatWeight(item.weight)}
              </span>
            )}
          </p>
        )}

        {/* Description - only show for non-coin identified items or when editing non-coins */}
        {!displayIsCoins && (!isUnidentified || isEditing) && (
          <div className="mb-4">
            {isEditing ? (
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Enter description here..."
              />
            ) : (
              <MultiLineParagraph lines={item.description} />
            )}
          </div>
        )}

        {/* Liquidate button for treasure */}
        {isTreasure && item.goldValue && onLiquidateTreasure && !isEditing && (
          <div className="mb-4 border border-emerald-300 bg-emerald-50 rounded-md p-3">
            <p className="text-sm text-emerald-700 font-medium mb-2">Liquidate Treasure</p>
            {(item.quantity || 1) > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm text-gray-600">Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={item.quantity || 1}
                  value={liquidateQty}
                  onChange={(e) => setLiquidateQty(Math.max(1, Math.min(item.quantity || 1, parseInt(e.target.value) || 1)))}
                  className="w-20 p-1 border border-gray-300 rounded text-gray-900 bg-white text-center"
                />
                <span className="text-sm text-gray-500">of {item.quantity}</span>
              </div>
            )}
            <button
              onClick={handleLiquidate}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              Liquidate {liquidateQty > 1 ? `${liquidateQty}x ` : ''}to {item.goldValue * Math.min(liquidateQty, item.quantity || 1)} Gold
            </button>
          </div>
        )}

        {/* Identify button for unidentified items */}
        {isUnidentified && onIdentify && !isEditing && (
          <div className="mb-4">
            <button
              onClick={handleIdentify}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              <span>✨</span> Identify Item
            </button>
          </div>
        )}

        {/* Transfer Section */}
        {characters && characters.length > 0 && onTransfer && (
          <div className="mb-4 border-t pt-4">
            <button
              onClick={() => setShowTransfer(!showTransfer)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
            >
              <span>{showTransfer ? 'v' : '>'}</span>
              Transfer to...
            </button>

            {showTransfer && (
              <div className="mt-3 space-y-3 bg-gray-50 p-3 rounded-md">
                {/* Partial transfer for coins */}
                {isCoins && item.coins && (
                  <div className="border border-yellow-300 bg-yellow-50 rounded-md p-3">
                    <p className="text-sm text-yellow-700 font-medium mb-2">Amount to Transfer</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(item.coins.platinum || 0) > 0 && (
                        <div>
                          <label className="block text-xs text-gray-600">Platinum (max {item.coins.platinum})</label>
                          <input
                            type="number"
                            min="0"
                            max={item.coins.platinum}
                            value={transferPlatinum}
                            onChange={(e) => setTransferPlatinum(Math.min(parseInt(e.target.value) || 0, item.coins.platinum))}
                            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                      )}
                      {(item.coins.gold || 0) > 0 && (
                        <div>
                          <label className="block text-xs text-gray-600">Gold (max {item.coins.gold})</label>
                          <input
                            type="number"
                            min="0"
                            max={item.coins.gold}
                            value={transferGold}
                            onChange={(e) => setTransferGold(Math.min(parseInt(e.target.value) || 0, item.coins.gold))}
                            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                      )}
                      {(item.coins.silver || 0) > 0 && (
                        <div>
                          <label className="block text-xs text-gray-600">Silver (max {item.coins.silver})</label>
                          <input
                            type="number"
                            min="0"
                            max={item.coins.silver}
                            value={transferSilver}
                            onChange={(e) => setTransferSilver(Math.min(parseInt(e.target.value) || 0, item.coins.silver))}
                            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                      )}
                      {(item.coins.copper || 0) > 0 && (
                        <div>
                          <label className="block text-xs text-gray-600">Copper (max {item.coins.copper})</label>
                          <input
                            type="number"
                            min="0"
                            max={item.coins.copper}
                            value={transferCopper}
                            onChange={(e) => setTransferCopper(Math.min(parseInt(e.target.value) || 0, item.coins.copper))}
                            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setTransferPlatinum(item.coins.platinum || 0);
                        setTransferGold(item.coins.gold || 0);
                        setTransferSilver(item.coins.silver || 0);
                        setTransferCopper(item.coins.copper || 0);
                      }}
                      className="mt-2 text-xs text-yellow-600 hover:text-yellow-700 underline"
                    >
                      Transfer All
                    </button>
                  </div>
                )}

                {/* Partial transfer for treasures */}
                {isTreasure && (item.quantity || 1) > 1 && (
                  <div className="border border-emerald-300 bg-emerald-50 rounded-md p-3">
                    <p className="text-sm text-emerald-700 font-medium mb-2">Quantity to Transfer</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={item.quantity}
                        value={transferQuantity}
                        onChange={(e) => setTransferQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, item.quantity)))}
                        className="w-20 p-2 border border-gray-300 rounded-md text-gray-900 bg-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-600">of {item.quantity}</span>
                      <button
                        onClick={() => setTransferQuantity(item.quantity)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 underline ml-2"
                      >
                        All
                      </button>
                    </div>
                  </div>
                )}

                {/* Character dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Character
                  </label>
                  <select
                    value={selectedCharacterId}
                    onChange={(e) => setSelectedCharacterId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select character...</option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id}>
                        {char.name}{char.id === currentCharId ? ' (current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Container dropdown */}
                {selectedCharacterId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Container
                    </label>
                    <select
                      value={selectedContainerId}
                      onChange={(e) => setSelectedContainerId(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select container...</option>
                      {targetContainers
                        .filter(c => !(selectedCharacterId === currentCharId && c.id === currentContainerId))
                        .map((container) => (
                          <option key={container.id} value={container.id}>
                            {container.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Transfer button */}
                {selectedCharacterId && selectedContainerId && (
                  <button
                    onClick={handleTransfer}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                  >
                    Transfer{isCoins ? ` (${(parseInt(transferPlatinum) || 0) + (parseInt(transferGold) || 0) + (parseInt(transferSilver) || 0) + (parseInt(transferCopper) || 0)} coins)` : isTreasure && (item.quantity || 1) > 1 ? ` (${transferQuantity}x)` : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => {
              onClose();
              handleDelete();
            }}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-sm shadow transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50"
          >
            Delete
          </button>
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
              >
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

function MultiLineParagraph({ lines }) {
  const splitLines = (lines || "No description yet.").split("\n\n");
  return (
    <div className="text-gray-700 italic min-h-[6rem] border p-2 rounded-md bg-gray-50 overflow-y-scroll max-h-[45vh] text-left">
      {splitLines.map((line, index) => (
        <div key={index}>
          <p><LinkifiedText text={line} /></p>
          <br />
        </div>
      ))}
    </div>
  );
}
