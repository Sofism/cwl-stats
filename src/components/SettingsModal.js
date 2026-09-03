import React, { useState } from "react";
import { Settings, X, FilePlus } from "lucide-react";
import ManualWarModal from "./ManualWarModal";

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
  const readRole = (role, fallback) => {
    try {
      return localStorage.getItem(`cwl-${role}`) || fallback;
    } catch {
      return fallback;
    }
  };
  const [accent, setAccentState] = useState(() => readRole("accent", "lime"));
  const [alertColor, setAlertState] = useState(() => readRole("alert", "rust"));

  const pickRole = (role, id) => {
    if (role === "accent") setAccentState(id);
    else setAlertState(id);
    if (typeof window.setPaletteRole === "function") {
      window.setPaletteRole(role, id);
    }
  };

  const [showManualWar, setShowManualWar] = useState(false);

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
    <div className="fixed inset-0 bg-surface-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="border border-line rounded-md p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="w-6 h-6 text-accent-400" />
            Clan Settings
          </h3>
          <button onClick={onClose} className="text-txt-low hover:text-txt-hi transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-txt-low mb-4">
          Customize your clan names and tags. Tags are used to sync members automatically.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-txt-mid mb-2">
              Main Clan Name
            </label>
            <input
              type="text"
              value={mainName}
              onChange={(e) => setMainName(e.target.value)}
              placeholder="e.g., True North"
 className="w-full bg-surface-950 border border-line rounded px-4 py-3 text-txt-hi focus:border-accent-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-txt-mid mb-2">
              Main Clan Tag
            </label>
            <input
              type="text"
              value={mainTag}
              onChange={(e) => setMainTag(e.target.value)}
              placeholder="e.g., #PQQGGJYQ"
 className="w-full bg-surface-950 border border-line rounded px-4 py-3 text-txt-hi focus:border-accent-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-txt-mid mb-2">
              Secondary Clan Name
            </label>
            <input
              type="text"
              value={secondaryName}
              onChange={(e) => setSecondaryName(e.target.value)}
              placeholder="e.g., DD"
 className="w-full bg-surface-950 border border-line rounded px-4 py-3 text-txt-hi focus:border-steel-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-txt-mid mb-2">
              Secondary Clan Tag
            </label>
            <input
              type="text"
              value={secondaryTag}
              onChange={(e) => setSecondaryTag(e.target.value)}
              placeholder="e.g., #2LL8C8Y2Q"
 className="w-full bg-surface-950 border border-line rounded px-4 py-3 text-txt-hi focus:border-steel-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-6 space-y-4">
          {[
            { role: "accent", label: "Primary colour", value: accent,
              hint: "Buttons, links and interactive elements." },
            { role: "alert", label: "Alert colour", value: alertColor,
              hint: "Missing attacks and pending threats." },
          ].map((row) => (
            <div key={row.role}>
              <label className="block text-sm text-txt-low mb-1">{row.label}</label>
              <p className="text-xs text-txt-hi0 mb-2">{row.hint}</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => pickRole(row.role, opt.id)}
 className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                      row.value === opt.id
                        ? "border-accent-400 text-txt-hi"
                        : "border-line-strong text-txt-low hover:text-txt-hi"
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
            </div>
          ))}
          {accent === alertColor && (
            <p className="text-xs text-amber-400">
              Both roles use the same colour — alerts will not stand out.
            </p>
          )}
        </div>

        <div className="mb-6 pt-4 border-t border-line">
          <label className="block text-sm text-txt-low mb-2">Data tools</label>
          <button
            onClick={() => setShowManualWar(true)}
            className="w-full border border-line-strong hover:border-accent-400 text-txt-mid hover:text-accent-400 rounded-md px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <FilePlus className="w-4 h-4" />
            Add manual war
          </button>
          <p className="text-xs text-txt-hi0 mt-2">
            For a regular clan war the automatic sync missed.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
 className="flex-1 border border-accent-400 text-accent-400 hover:bg-accent-900 text-txt-hi font-semibold py-3 rounded-md transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
 className="flex-1 bg-surface-700 hover:bg-surface-700 text-txt-hi font-semibold py-3 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {showManualWar && (
        <ManualWarModal clanNames={clanNames} onClose={() => setShowManualWar(false)} />
      )}
    </div>
  );
};

export default SettingsModal;
