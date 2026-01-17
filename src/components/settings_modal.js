import React, { useState } from "react";
import { Settings, X } from "lucide-react";

const SettingsModal = ({ clanNames, onSave, onClose }) => {
  const [mainName, setMainName] = useState(clanNames.main);
  const [secondaryName, setSecondaryName] = useState(clanNames.secondary);

  const handleSave = () => {
    if (!mainName.trim() || !secondaryName.trim()) {
      alert("Clan names cannot be empty");
      return;
    }
    onSave({
      main: mainName.trim(),
      secondary: secondaryName.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-400" />
            Clan Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Customize your clan names. These will appear throughout the app.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Main Clan Name
            </label>
            <input
              type="text"
              value={mainName}
              onChange={(e) => setMainName(e.target.value)}
              placeholder="e.g., True North"
              className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Secondary Clan Name
            </label>
            <input
              type="text"
              value={secondaryName}
              onChange={(e) => setSecondaryName(e.target.value)}
              placeholder="e.g., DD"
              className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;