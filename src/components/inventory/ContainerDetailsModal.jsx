import { useState, useEffect } from "react";
import { parseWeightInput } from "../../utils/utils";
import { useFormatWeight, usePartyConfig } from "../../contexts/PartyConfigContext";

export const ContainerDetailsModal = ({
  show,
  onClose,
  container,
  onSaveContainer,
  onDeleteContainer,
  onTransferAll,
}) => {
  const formatWeight = useFormatWeight();
  const { weightUnit } = usePartyConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(
    container ? container.name || "" : "",
  );
  const [editedWeightString, setEditedWeightString] = useState(
    container ? String(container.weight || 0) : "",
  );
  const [editedMaxCapacityString, setEditedMaxCapacityString] = useState(
    container ? String(container.maxCapacity || 0) : "",
  );
  const [editedDescription, setEditedDescription] = useState(
    container ? container.description || "" : "",
  );

  // Reset editing state when a different container is selected or modal opens fresh.
  // Keyed on container identity (id), not reference, so Firebase updates don't
  // clobber in-progress edits.
  const containerId = container?.id;
  useEffect(() => {
    setEditedName(container ? container.name || "" : "");
    setEditedWeightString(container ? String(container.weight || 0) : "");
    setEditedMaxCapacityString(
      container ? String(container.maxCapacity || 0) : "",
    );
    setEditedDescription(container ? container.description || "" : "");
    setIsEditing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, show]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show || !container) return null;

  const handleSave = () => {
    const parsedWeight = parseWeightInput(editedWeightString);
    const parsedMaxCapacity = parseWeightInput(editedMaxCapacityString);
    if (isNaN(parsedWeight)) {
      alert(
        "Invalid container slot format. Please enter a number (usually 0 for containers in use).",
      );
      return;
    }

    if (isNaN(parsedMaxCapacity) || parsedMaxCapacity < 0) {
      alert(
        "Invalid capacity format. Capacity must be a positive number (e.g., '10' or '16').",
      );
      return;
    }
    onSaveContainer(
      container.id,
      editedName,
      parsedWeight,
      parsedMaxCapacity,
      editedDescription,
    );
    setIsEditing(false);
  };

  const handleDelete = () => {
    onClose();
    onDeleteContainer(container.id, container.name);
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full text-gray-900">
        <h3 className="text-2xl font-bold text-blue-600 mb-4 border-b pb-2">
          {isEditing
            ? `Editing ${container.name}`
            : `${container.name} Details`}
        </h3>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">Name:</p>
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-700">{container.name}</p>
          )}
        </div>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">Container Slots:</p>
          {isEditing ? (
            <input
              type="text"
              value={editedWeightString}
              onChange={(e) => setEditedWeightString(e.target.value)}
              placeholder={`Container slots in ${weightUnit.plural} (usually 0)`}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-700">
              {formatWeight(container.weight || 0)}
            </p>
          )}
        </div>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">Max Capacity:</p>
          {isEditing ? (
            <input
              type="text"
              value={editedMaxCapacityString}
              onChange={(e) => setEditedMaxCapacityString(e.target.value)}
              placeholder={`Max capacity in ${weightUnit.plural} (e.g., 16)`}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-700">
              {formatWeight(container.maxCapacity || 0)}
            </p>
          )}
        </div>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">Description:</p>
          {isEditing ? (
            <textarea
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Enter description here..."
            />
          ) : (
            <p className="text-gray-700 italic min-h-[6rem] border p-2 rounded-md bg-gray-50">
              {container.description || "No description yet."}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-4">
          <button
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Delete
          </button>
          {/* Transfer All Button - only show if container has items and not editing */}
          {!isEditing && (container.items || []).length > 0 && onTransferAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTransferAll();
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              ↔️ Transfer All ({(container.items || []).length})
            </button>
          )}
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
