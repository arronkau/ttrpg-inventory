import { useState, useEffect } from "react";
import { formatModifier } from "../../utils/encumbrance";

export const CharacterDetailsModal = ({
  show,
  onClose,
  character,
  onSaveCharacter,
  onDeleteCharacter,
  onSendCharacterToBottom,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(
    character ? character.name || "" : "",
  );
  const [editedStrengthModifier, setEditedStrengthModifier] = useState(
    character ? String(character.strengthModifier || 0) : "0",
  );

  useEffect(() => {
    setEditedName(character ? character.name || "" : "");
    setEditedStrengthModifier(character ? String(character.strengthModifier || 0) : "0");
    setIsEditing(false);
  }, [character, show]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show || !character) return null;

  const handleSave = () => {
    const parsedStrengthModifier = Number(editedStrengthModifier);
    if (!Number.isFinite(parsedStrengthModifier)) {
      alert("Invalid STR modifier. Please enter a number, such as -1, 0, or 2.");
      return;
    }

    onSaveCharacter(character.id, editedName, Math.trunc(parsedStrengthModifier));
    setIsEditing(false);
  };

  const handleDelete = () => {
    onClose();
    onDeleteCharacter(character.id);
  };

  const handleSendCharacterToBottom = () => {
    onClose();
    onSendCharacterToBottom();
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full text-gray-900">
        <h3 className="text-2xl font-bold text-blue-600 mb-4 border-b pb-2">
          {isEditing
            ? `Editing ${character.name}`
            : `${character.name} Details`}
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
            <p className="text-gray-700">{character.name}</p>
          )}
        </div>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">STR Modifier:</p>
          {isEditing ? (
            <input
              type="number"
              step="1"
              value={editedStrengthModifier}
              onChange={(e) => setEditedStrengthModifier(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-700">{formatModifier(character.strengthModifier || 0)}</p>
          )}
        </div>

        <div className="flex justify-center gap-1 mt-4">
          <button
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Delete
          </button>
          <button
            onClick={handleSendCharacterToBottom}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Bottom
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
