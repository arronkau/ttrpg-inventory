import { useState, useEffect } from "react";

export const DeleteConfirmationModal = ({
  show,
  onClose,
  onConfirm,
  targetName,
  requiredText,
}) => {
  const [inputValue, setInputValue] = useState("");
  const isInputCorrect =
    inputValue.trim().toLowerCase() === requiredText.toLowerCase();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        setInputValue("");
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const handleConfirmClick = () => {
    if (isInputCorrect) {
      onConfirm();
      setInputValue("");
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          Confirm Deletion
        </h3>
        <p className="text-gray-700 mb-4">
          To delete "
          <span className="font-bold text-red-600">{targetName}</span>", please
          type "<span className="font-bold text-red-600">{requiredText}</span>"
          in the box below:
        </p>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Type "${requiredText}" to confirm`}
          className="w-full p-2 border border-gray-300 rounded-md mb-4 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && isInputCorrect) {
              handleConfirmClick();
              onClose();
            }
          }}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={handleConfirmClick}
            disabled={!isInputCorrect}
            className={`font-bold py-2 px-4 rounded-lg transition duration-200
                            ${isInputCorrect ? "bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50" : "bg-gray-300 text-gray-500 cursor-not-allowed"}
                        `}
          >
            Delete
          </button>
          <button
            onClick={() => {
              setInputValue("");
              onClose();
            }}
            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
