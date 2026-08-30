import React, { useState } from "react";
import { Settings, X } from "lucide-react";

const ACCENT_OPTIONS = [
  { id: "lime", label: "Lime", swatch: "#a8c74e" },
  { id: "azure", label: "Cold blue", swatch: "#5b9dd9" },
  { id: "amber", label: "Amber", swatch: "#d9a441" },
  { id: "rust", label: "Rust", swatch: "#e0754a" },
  { id: "violet", label: "Violet", swatch: "#927dd6" },
];

const SettingsModal = ({ clanNames, onSave, onClose }) => {
  // El acento vive en una variable CSS: cambiarlo se aplica al instante y
  // se recuerda en localStorage, sin necesidad de recompilar ni desplegar.
  const [accent, setAccentState] = useState(() => {
    try {
      return localStorage.getItem("cwl-accent") || "lime";
    } catch {
      return "lime";
    }
  });

  const pickAccent = (id) => {
    setAccentState(id);
    if (typeof window.setAccent === "function") window.setAccent(id);
  };

  const [mainName, setMainName] = useState(clanNames.main);
  const [secondaryName, setSecondaryName] = useState(clanNames.secondary);
  const [mainTag, setMainTag] = useState(clanNames.mainTag || "");
  const [secondaryTag, setSecondaryTag] = useState(clanNames.secondaryTag || "");

  const handleSave = () => {
    if (!mainName.trim() || !secondaryName.trim()) {
      alert("Clan names cannot be empty");
      return;
    }
    onSave({
      main: mainName.trim(),
      secondary: secondaryName.trim(),
      mainTag: mainTag.trim(),
      secondaryTag: secondaryTag.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-void-800 border border-void-700 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-signal-400" />
            Clan Settings
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-ink-400 mb-4">
          Customize your clan names and tags. Tags are used to sync members automatically.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Main Clan Name
            </label>
            <input
              type="text"
              value={mainName}
              onChange={(e) => setMainName(e.target.value)}
              placeholder="e.g., True North"
              className="w-full bg-void-950 border border-void-700 rounded px-4 py-3 text-white focus:border-signal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Main Clan Tag
            </label>
            <input
              type="text"
              value={mainTag}
              onChange={(e) => setMainTag(e.target.value)}
              placeholder="e.g., #PQQGGJYQ"
              className="w-full bg-void-950 border border-void-700 rounded px-4 py-3 text-white focus:border-signal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Secondary Clan Name
            </label>
            <input
              type="text"
              value={secondaryName}
              onChange={(e) => setSecondaryName(e.target.value)}
              placeholder="e.g., DD"
              className="w-full bg-void-950 border border-void-700 rounded px-4 py-3 text-white focus:border-steel-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Secondary Clan Tag
            </label>
            <input
              type="text"
              value={secondaryTag}
              onChange={(e) => setSecondaryTag(e.target.value)}
              placeholder="e.g., #2LL8C8Y2Q"
              className="w-full bg-void-950 border border-void-700 rounded px-4 py-3 text-white focus:border-steel-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-ink-400 mb-3">Accent colour</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => pickAccent(opt.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  accent === opt.id
                    ? "border-signal-400 text-white"
                    : "border-void-600 text-ink-400 hover:text-white"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: opt.swatch }}
                />
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-500 mt-2">
            Applies instantly and is remembered on this device.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-signal-500 hover:bg-signal-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-void-700 hover:bg-void-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
