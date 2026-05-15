import { useState, useEffect } from "react";

export const AddStorageModal = ({ show, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [slotLimit, setSlotLimit] = useState('0');

  useEffect(() => {
    if (show) {
      setName('');
      setSlotLimit('0');
    }
  }, [show]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const handleSubmit = () => {
    const parsedLimit = Number(slotLimit || 0);
    if (!name.trim()) {
      alert('Enter a storage name.');
      return;
    }
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      alert('Invalid slot limit. Use 0 for infinite storage or a positive number.');
      return;
    }
    onSubmit(name.trim(), Math.trunc(parsedLimit));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full text-gray-900">
        <h3 className="text-2xl font-bold text-amber-600 mb-4 border-b pb-2">
          Add Storage
        </h3>

        <div className="mb-4">
          <label className="block font-semibold text-lg mb-2">Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Bank"
            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            autoFocus
          />
        </div>

        <div className="mb-4">
          <label className="block font-semibold text-lg mb-2">Slot Limit:</label>
          <input
            type="number"
            min="0"
            step="1"
            value={slotLimit}
            onChange={(e) => setSlotLimit(e.target.value)}
            placeholder="0 means infinite"
            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-sm text-gray-500 mt-1">Use 0 for infinite storage.</p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Add Storage
          </button>
        </div>
      </div>
    </div>
  );
};

export const StorageDetailsModal = ({
  show,
  onClose,
  storage,
  onSaveStorage,
  onDeleteStorage,
  onSendStorageToBottom,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(storage ? storage.name || '' : '');
  const [editedSlotLimit, setEditedSlotLimit] = useState(storage ? String(storage.storageLimit || 0) : '0');

  useEffect(() => {
    setEditedName(storage ? storage.name || '' : '');
    setEditedSlotLimit(storage ? String(storage.storageLimit || 0) : '0');
    setIsEditing(false);
  }, [storage, show]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show || !storage) return null;

  const handleSave = () => {
    const parsedLimit = Number(editedSlotLimit || 0);
    if (!editedName.trim()) {
      alert('Enter a storage name.');
      return;
    }
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      alert('Invalid slot limit. Use 0 for infinite storage or a positive number.');
      return;
    }
    onSaveStorage(storage.id, editedName.trim(), Math.trunc(parsedLimit));
    setIsEditing(false);
  };

  const handleDelete = () => {
    onClose();
    onDeleteStorage(storage.id, storage.name);
  };

  const handleSendStorageToBottom = () => {
    onClose();
    onSendStorageToBottom(storage.id);
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full text-gray-900">
        <h3 className="text-2xl font-bold text-amber-600 mb-4 border-b pb-2">
          {isEditing ? `Editing ${storage.name}` : `${storage.name} Details`}
        </h3>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">Name:</p>
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          ) : (
            <p className="text-gray-700">{storage.name}</p>
          )}
        </div>

        <div className="mb-4">
          <p className="font-semibold text-lg mb-2">Slot Limit:</p>
          {isEditing ? (
            <input
              type="number"
              min="0"
              step="1"
              value={editedSlotLimit}
              onChange={(e) => setEditedSlotLimit(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          ) : (
            <p className="text-gray-700">
              {Number(storage.storageLimit || 0) > 0 ? `${storage.storageLimit} slots` : 'Infinite'}
            </p>
          )}
          {isEditing && <p className="text-sm text-gray-500 mt-1">Use 0 for infinite storage.</p>}
        </div>

        <div className="flex justify-center gap-1 mt-4">
          <button
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Delete
          </button>
          <button
            onClick={handleSendStorageToBottom}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Bottom
          </button>
          {isEditing ? (
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              Save
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
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
