import { useState, useEffect } from "react";
import { usePartyConfig } from "../../contexts/PartyConfigContext";

const EXAMPLE_JSON = `[
  { "name": "Longsword", "weight": 1, "description": "A fine steel blade" },
  { "name": "Torch", "weight": 1 },
  { "itemType": "coins", "coins": { "gold": 50, "silver": 20 } },
  { "itemType": "treasure", "name": "Ruby", "goldValue": 100, "quantity": 2, "weightPerItem": 0 }
]`;

export const ImportItemsModal = ({ show, onClose, onImport }) => {
  const { coinsPerWeightUnit } = usePartyConfig();
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (show) {
      setJsonText("");
      setError("");
      setPreview(null);
    }
  }, [show]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  const parseAndValidate = (text) => {
    if (!text.trim()) {
      setError("");
      setPreview(null);
      return null;
    }

    try {
      const parsed = JSON.parse(text);

      // Accept both single item and array
      const items = Array.isArray(parsed) ? parsed : [parsed];

      // Validate and normalize items
      const validatedItems = items.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`Item ${index + 1} is not a valid object`);
        }

        // Handle coins
        if (item.itemType === 'coins') {
          const coins = item.coins || {};
          const totalCoins = (coins.platinum || 0) + (coins.gold || 0) +
                            (coins.silver || 0) + (coins.copper || 0);
          if (totalCoins <= 0) {
            throw new Error(`Item ${index + 1}: Coins must have at least one denomination`);
          }
          const weight = Math.ceil(totalCoins / coinsPerWeightUnit);
          const parts = [];
          if (coins.platinum > 0) parts.push(`${coins.platinum}p`);
          if (coins.gold > 0) parts.push(`${coins.gold}g`);
          if (coins.silver > 0) parts.push(`${coins.silver}s`);
          if (coins.copper > 0) parts.push(`${coins.copper}c`);

          return {
            name: `$ ${parts.join(' ')}`,
            weight,
            description: '',
            itemType: 'coins',
            coins: {
              platinum: coins.platinum || 0,
              gold: coins.gold || 0,
              silver: coins.silver || 0,
              copper: coins.copper || 0,
            },
          };
        }

        // Handle treasure
        if (item.itemType === 'treasure') {
          if (!item.name) {
            throw new Error(`Item ${index + 1}: Treasure must have a name`);
          }
          const goldValue = parseInt(item.goldValue, 10) || 0;
          const quantity = parseInt(item.quantity, 10) || 1;
          const weightPerItem = parseFloat(item.weightPerItem) || 0;

          let baseName = item.name.replace(/^\d+x\s*/, '').replace(/\s*\(\d+g\)\s*$/, '').trim();
          const treasureName = quantity > 1
            ? `${quantity}x ${baseName} (${goldValue}g)`
            : `${baseName} (${goldValue}g)`;

          return {
            name: treasureName,
            weight: weightPerItem * quantity,
            description: item.description || '',
            itemType: 'treasure',
            goldValue,
            quantity,
            weightPerItem,
          };
        }

        // Handle normal items
        if (!item.name) {
          throw new Error(`Item ${index + 1}: Normal items must have a name`);
        }

        const normalItem = {
          name: item.name,
          weight: parseFloat(item.weight) || 0,
          description: item.description || '',
        };

        // Handle unidentified items
        if (item.isUnidentified) {
          normalItem.isUnidentified = true;
          normalItem.secretName = item.secretName || '';
          normalItem.secretDescription = item.secretDescription || '';
        }

        return normalItem;
      });

      setError("");
      setPreview(validatedItems);
      return validatedItems;
    } catch (e) {
      setError(e.message);
      setPreview(null);
      return null;
    }
  };

  const handleTextChange = (text) => {
    setJsonText(text);
    parseAndValidate(text);
  };

  const handleImport = () => {
    const items = parseAndValidate(jsonText);
    if (items && items.length > 0) {
      onImport(items);
      onClose();
    }
  };

  const loadExample = () => {
    setJsonText(EXAMPLE_JSON);
    parseAndValidate(EXAMPLE_JSON);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          Import Items from JSON
        </h3>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Paste JSON
            </label>
            <button
              onClick={loadExample}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Load Example
            </button>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={`Paste JSON array of items...\n\nExample:\n${EXAMPLE_JSON}`}
            rows="10"
            className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-300 rounded-md">
            <p className="text-sm text-red-700 font-medium">Error parsing JSON:</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {preview && preview.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-md">
            <p className="text-sm text-green-700 font-medium mb-2">
              Preview ({preview.length} item{preview.length !== 1 ? 's' : ''})
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {preview.map((item, index) => (
                <div key={index} className="text-sm text-gray-700 flex justify-between bg-white px-2 py-1 rounded">
                  <span className={
                    item.itemType === 'coins' ? 'text-yellow-600' :
                    item.itemType === 'treasure' ? 'text-emerald-600' :
                    item.isUnidentified ? 'text-purple-600' : ''
                  }>
                    {item.itemType === 'coins' && '$ '}
                    {item.itemType === 'treasure' && '* '}
                    {item.isUnidentified && '? '}
                    {item.name}
                  </span>
                  <span className="text-yellow-700">{item.weight} slots</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded">
          <p className="font-medium mb-1">Supported item formats:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>Normal:</strong> {`{ "name": "...", "weight": N, "description": "..." }`} (weight is used as item slots)</li>
            <li><strong>Coins:</strong> {`{ "itemType": "coins", "coins": { "gold": N, ... } }`}</li>
            <li><strong>Treasure:</strong> {`{ "itemType": "treasure", "name": "...", "goldValue": N, "quantity": N, "weightPerItem": N }`} (weightPerItem is slots each)</li>
            <li><strong>Unidentified:</strong> {`{ "name": "...", "isUnidentified": true, "secretName": "...", "secretDescription": "..." }`}</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || preview.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200"
          >
            Import {preview ? `(${preview.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
