// ============================================
// components/NewSeasonModal.jsx
// ============================================
import React, { useState } from "react";

const NewSeasonModal = ({ onCreateSeason, onCancel }) => {
  const [newSeasonName, setNewSeasonName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">New Season</h3>
        <input
          type="text"
          value={newSeasonName}
          onChange={(e) => setNewSeasonName(e.target.value)}
          placeholder="e.g., December 2024"
          className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-3 mb-4 text-white"
        />
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (!newSeasonName.trim()) return;
              onCreateSeason(newSeasonName.trim());
            }}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded transition-colors"
          >
            Create
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewSeasonModal;
