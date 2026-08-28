import React, { useState } from "react";

const NewSeasonModal = ({ onCreateSeason, onCancel }) => {
  const [newSeasonName, setNewSeasonName] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Generar lista de años (últimos 5 y próximos 2)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 2; i++) {
    years.push(i);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-void-800 border border-void-700 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">New Season</h3>
        
        <div className="mb-4">
          <label className="block text-sm text-ink-400 mb-2">Season Name</label>
          <input
            type="text"
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            placeholder="e.g., December 2024"
            className="w-full bg-void-950 border border-void-700 rounded px-4 py-3 text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-ink-400 mb-2">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full bg-void-950 border border-void-700 rounded px-4 py-3 text-white"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (!newSeasonName.trim()) return;
              onCreateSeason(newSeasonName.trim(), selectedYear);
            }}
            className="flex-1 bg-signal-500 hover:bg-signal-600 text-white font-bold py-2 rounded transition-colors"
          >
            Create
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-void-700 hover:bg-void-600 text-white font-bold py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewSeasonModal;