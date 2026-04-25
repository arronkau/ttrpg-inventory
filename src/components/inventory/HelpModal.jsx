import { useEffect } from "react";

export const HelpModal = ({ show, onClose }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Help</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto text-gray-800 space-y-4">
          <section>
            <h4 className="font-semibold text-gray-900 mb-1">Sharing a party</h4>
            <p>
              The URL is the party. Send the page URL to anyone you want at the
              table — they'll see the same inventory in real time. Edits from
              any browser show up everywhere within a second or two.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">Item types</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="text-purple-600 font-semibold">? Unidentified</span> —
                shows a placeholder name until someone clicks "Identify" in the
                item details.
              </li>
              <li>
                <span className="text-emerald-600 font-semibold">* Treasure</span> —
                a gemstone, art object, etc., with a gold value. Can be
                liquidated into coins.
              </li>
              <li>
                <span className="text-yellow-600 font-semibold">$ Coins</span> —
                platinum / gold / silver / copper. Weight is automatic
                (50 coins = 1 lb). Coins added to a container that already has
                coins will merge.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">Keyboard shortcuts</h4>
            <ul className="list-disc list-inside">
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-sm font-mono">e</kbd>
                {' '}— expand or collapse all characters and containers.
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-sm font-mono">Esc</kbd>
                {' '}— close any open modal.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">Bulk import</h4>
            <p>
              The <span className="font-mono">{"{ }"}</span> button next to
              "Add Item" accepts a JSON array of items, so you can paste a hoard
              from your prep notes in one go. See the{' '}
              <a
                href="https://github.com/beaurancourt/ttrpg-inventory#bulk-import-format"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                bulk import format
              </a>
              {' '}for the full schema.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">Audit log</h4>
            <p>
              The 📋 Audit Log button at the top shows every change made to
              this party — useful for "who took the rope?" arguments and for
              recovering after an accidental delete.
            </p>
          </section>
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
