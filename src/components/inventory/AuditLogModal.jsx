import { useEffect } from "react";

export const AuditLogModal = ({ show, onClose, auditLog }) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return '➕';
      case 'deleted': return '🗑️';
      case 'edited': return '✏️';
      case 'moved': return '↔️';
      default: return '•';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created': return 'text-green-600';
      case 'deleted': return 'text-red-600';
      case 'edited': return 'text-blue-600';
      case 'moved': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Audit Log</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!auditLog || auditLog.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {auditLog.map((entry, index) => (
                <div key={entry.id || index} className="border-l-4 border-gray-300 pl-4 py-2">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getActionIcon(entry.action)}</span>
                    <div className="flex-1">
                      <p className="text-gray-900">
                        <span className={`font-semibold ${getActionColor(entry.action)}`}>
                          {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                        </span>
                        {' '}{entry.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
