import { useState, useEffect } from 'react';

export const TransferAllItemsModal = ({ show, onClose, onConfirm, characters, sourceCharId, sourceContainerId }) => {
  const [targetCharId, setTargetCharId] = useState('');
  const [targetContainerId, setTargetContainerId] = useState('');

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        setTargetCharId('');
        setTargetContainerId('');
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const targetCharacter = characters.find(c => c.id === targetCharId);
  const targetContainers = targetCharacter?.containers || [];

  const handleConfirm = () => {
    if (targetCharId && targetContainerId) {
      onConfirm(targetCharId, targetContainerId);
      setTargetCharId('');
      setTargetContainerId('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Transfer All Items
        </h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Character / Storage
          </label>
          <select
            value={targetCharId}
            onChange={(e) => {
              setTargetCharId(e.target.value);
              setTargetContainerId(''); // Reset container when character changes
            }}
            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select character or storage...</option>
            {characters.map(char => (
              <option key={char.id} value={char.id}>
                {char.name}{char.isStorage ? ' (storage)' : ''}
              </option>
            ))}
          </select>
        </div>

        {targetCharId && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Container
            </label>
            <select
              value={targetContainerId}
              onChange={(e) => setTargetContainerId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a container...</option>
              {targetContainers.map(container => {
                // Don't allow selecting the same container as source
                const isSameContainer = targetCharId === sourceCharId && container.id === sourceContainerId;
                if (isSameContainer) return null;
                return (
                  <option key={container.id} value={container.id}>
                    {container.name}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              setTargetCharId('');
              setTargetContainerId('');
              onClose();
            }}
            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetCharId || !targetContainerId}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
};
