import { useState, useEffect } from "react";
import { parseWeightInput } from "../../utils/utils";
import { usePartyConfig } from "../../contexts/PartyConfigContext";

export const AddContainerModal = ({ show, onClose, onSubmit }) => {
  const { weightUnit } = usePartyConfig();
  const [containerName, setContainerName] = useState("");
  const [containerWeight, setContainerWeight] = useState("");
  const [maxCapacityString, setMaxCapacityString] = useState("");

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        setContainerName("");
        setContainerWeight("");
        setMaxCapacityString("");
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const handleSubmit = () => {
    const weightPounds = parseWeightInput(containerWeight);
    const maxCapacityPounds = parseWeightInput(maxCapacityString);
    if (isNaN(weightPounds)) {
      alert(
        "Invalid container slot format. Please enter a number (usually 0 for containers in use).",
      );
      return;
    }
    if (!isNaN(maxCapacityPounds) && maxCapacityPounds >= 0) {
      onSubmit(containerName, weightPounds, maxCapacityPounds);
      setContainerName("");
      setContainerWeight("");
      setMaxCapacityString("");
    } else {
      alert(
        "Invalid capacity format. Capacity must be a positive number (e.g., '10' or '16').",
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          Add New Container
        </h3>
        <input
          type="text"
          value={containerName}
          onChange={(e) => setContainerName(e.target.value)}
          placeholder="Container Name (e.g., 'Potion Pouch')"
          className="w-full p-2 border border-gray-300 rounded-md mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={containerWeight}
          onChange={(e) => setContainerWeight(e.target.value)}
          placeholder={`Container slots in ${weightUnit.plural} (usually 0)`}
          className="w-full p-2 border border-gray-300 rounded-md mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={maxCapacityString}
          onChange={(e) => setMaxCapacityString(e.target.value)}
          placeholder={`Max capacity in ${weightUnit.plural}`}
          className="w-full p-2 border border-gray-300 rounded-md mb-4 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setContainerName("");
              setMaxCapacityString("");
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
            Add Container
          </button>
        </div>
      </div>
    </div>
  );
};
