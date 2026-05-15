import { useState, useEffect, useRef } from "react";
import { sanitizeDefaultContainers } from "../../utils/encumbrance";

export const PartyConfigModal = ({ show, onClose, config, onSave, onExportBackup, onRestoreBackup }) => {
  const [singular, setSingular] = useState(config.weightUnit?.singular || "slot");
  const [plural, setPlural] = useState(config.weightUnit?.plural || "slots");
  const [coinsPerWeightUnit, setCoinsPerWeightUnit] = useState(
    String(config.coinsPerWeightUnit || 100),
  );
  const [containers, setContainers] = useState(sanitizeDefaultContainers(config.defaultContainers || []));
  const [restoreError, setRestoreError] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreFileInputRef = useRef(null);

  // Reset local state whenever the modal opens or the upstream config changes.
  useEffect(() => {
    if (show) {
      setSingular(config.weightUnit?.singular || "slot");
      setPlural(config.weightUnit?.plural || "slots");
      setCoinsPerWeightUnit(String(config.coinsPerWeightUnit || 100));
      setContainers(
        sanitizeDefaultContainers(config.defaultContainers || []).map((c) => ({ ...c })),
      );
      setRestoreError("");
      setIsRestoring(false);
    }
  }, [show, config]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && show) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const updateContainer = (index, field, value) => {
    setContainers((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  };

  const addContainer = () => {
    setContainers((prev) => [...prev, { name: "", weight: 0, maxCapacity: 0 }]);
  };

  const removeContainer = (index) => {
    setContainers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      'Importing this backup will replace all current characters, containers, items, settings, and audit log entries for this party. Continue?',
    );
    if (!confirmed) return;

    setRestoreError('');
    setIsRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await onRestoreBackup(backup);
      onClose();
    } catch (error) {
      console.error('Error restoring backup:', error);
      setRestoreError(error.message || 'Could not restore backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSave = () => {
    const trimmedSingular = singular.trim() || "slot";
    const trimmedPlural = plural.trim() || trimmedSingular;
    const ratio = Math.max(1, Math.floor(Number(coinsPerWeightUnit) || 100));
    const cleanedContainers = sanitizeDefaultContainers(containers)
      .map((c) => ({
        name: (c.name || "").trim(),
        weight: Number(c.weight) || 0,
        maxCapacity: Number(c.maxCapacity) || 0,
      }))
      .filter((c) => c.name.length > 0);

    onSave({
      weightUnit: { singular: trimmedSingular, plural: trimmedPlural },
      coinsPerWeightUnit: ratio,
      defaultContainers: cleanedContainers,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Party Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto text-gray-800 space-y-6">
          <section>
            <h4 className="font-semibold text-gray-900 mb-2">Encumbrance unit</h4>
            <p className="text-sm text-gray-600 mb-2">
              How encumbrance values are labelled throughout the app. This fork defaults to {" "}
              <span className="font-mono">slot / slots</span>.
            </p>
            <div className="flex gap-3">
              <label className="flex-1 text-sm">
                <span className="block font-medium text-gray-700 mb-1">Singular (1)</span>
                <input
                  type="text"
                  value={singular}
                  onChange={(e) => setSingular(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex-1 text-sm">
                <span className="block font-medium text-gray-700 mb-1">Plural (other)</span>
                <input
                  type="text"
                  value={plural}
                  onChange={(e) => setPlural(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-2">Coin slots</h4>
            <p className="text-sm text-gray-600 mb-2">
              How many coins or gems count as one item slot. The item-based
              encumbrance rules use 100.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min="1"
                step="1"
                value={coinsPerWeightUnit}
                onChange={(e) => setCoinsPerWeightUnit(e.target.value)}
                className="w-24 p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">
                coins = 1 {(singular.trim() || "slot")}
              </span>
            </label>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-2">Backup and restore</h4>
            <p className="text-sm text-gray-600 mb-3">
              Export this party's characters, containers, items, settings, and audit log as JSON. Importing a backup replaces the current party data.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-sm"
              >
                Export backup JSON
              </button>
              <button
                type="button"
                onClick={() => restoreFileInputRef.current?.click()}
                disabled={isRestoring}
                className={`text-white font-bold py-2 px-3 rounded-lg text-sm ${
                  isRestoring ? 'bg-gray-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isRestoring ? 'Restoring…' : 'Import backup JSON'}
              </button>
              <input
                ref={restoreFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleRestoreFile}
              />
            </div>
            {restoreError && (
              <p className="text-sm text-red-600 mt-2">{restoreError}</p>
            )}
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-2">Default containers for new characters</h4>
            <p className="text-sm text-gray-600 mb-2">
              Each new character also gets the four built-in equipped containers: Left Hand,
              Right Hand, Armor, and Other Equipped. Configure only the stowed containers here.
            </p>
            <div className="space-y-2">
              {containers.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  New characters will be created with no containers. Add one below.
                </p>
              ) : (
                containers.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <label className="flex-1 text-sm">
                      <span className="block font-medium text-gray-700 mb-1">Name</span>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateContainer(idx, "name", e.target.value)}
                        placeholder="Backpack"
                        className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="w-24 text-sm">
                      <span className="block font-medium text-gray-700 mb-1">Container Slots</span>
                      <input
                        type="number"
                        step="0.01"
                        value={c.weight}
                        onChange={(e) => updateContainer(idx, "weight", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="w-24 text-sm">
                      <span className="block font-medium text-gray-700 mb-1">Capacity</span>
                      <input
                        type="number"
                        step="0.01"
                        value={c.maxCapacity}
                        onChange={(e) => updateContainer(idx, "maxCapacity", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <button
                      onClick={() => removeContainer(idx)}
                      className="px-2 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={addContainer}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
            >
              + Add container
            </button>
          </section>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
