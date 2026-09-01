import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const ColumnSelector = ({ visibleCols, setVisibleCols, showColSelector, setShowColSelector }) => {
  const columns = [
    { key: "th", label: "TH" },
    { key: "wars", label: "Wars" },
    { key: "missAtk", label: "Miss Atk" },
    { key: "missDef", label: "Miss Def" },
    { key: "netStars", label: "Net ★" },
    { key: "netPercent", label: "Net %" },
    { key: "threeRate", label: "3★%" },
    { key: "starGain", label: "★ Gain" },
    { key: "percentGain", label: "% Gain" },
    { key: "starGive", label: "★ Give" },
    { key: "percentGive", label: "% Give" },
  ];

  return (
    <div className="mb-4 border border-line rounded-md p-4">
      <button
        onClick={() => setShowColSelector(!showColSelector)}
 className="flex items-center justify-between w-full text-sm font-semibold"
      >
        <span>Column Visibility</span>
        {showColSelector ? (
          <ChevronDown className="w-4 h-4 text-txt-low" />
        ) : (
          <ChevronRight className="w-4 h-4 text-txt-low" />
        )}
      </button>
      {showColSelector && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          {columns.map(({ key, label }) => (
            <label
              key={key}
 className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-700/30 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={visibleCols[key]}
                onChange={(e) =>
                  setVisibleCols({ ...visibleCols, [key]: e.target.checked })
                }
 className="rounded"
              />
              <span className="text-txt-mid">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColumnSelector;
