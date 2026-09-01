import React, { memo } from "react";
import { AlertCircle } from "lucide-react";

const StatsTable = memo(({ 
  data, 
  visibleCols, 
  activePage, 
  onPlayerSelect,
  onToggleBonus,
  bonusCount,
  selectedBonuses = []
}) => {
  const bonusesUsed = selectedBonuses.length;
  const canAddMore = bonusesUsed < bonusCount;

  return (
    <>
      <div className="bg-surface-800 border border-line-strong rounded-md p-4 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-txt-low flex-shrink-0 mt-0.5" />
          <div className="text-sm text-txt-mid">
            <p className="font-semibold mb-1">Missed Defences Correction:</p>
            <p>
              When a player misses a defence, the system adds{" "}
              <span className="font-semibold">+2 stars</span> and{" "}
              <span className="font-semibold">+85%</span> to defensive stats for
              fair ranking.
            </p>
          </div>
        </div>
      </div>

      {/* Bonus Counter */}
      {bonusCount > 0 && (
        <div className={`mb-4 p-4 rounded-md border ${
          bonusesUsed === bonusCount 
            ? "bg-ok-900/40 border-ok-400/40" 
            : bonusesUsed > bonusCount
            ? "bg-bad-900/40 border-bad-400/40"
            : "bg-amber-900/40 border-amber-400/40"
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              Bonuses Awarded: {bonusesUsed} / {bonusCount}
            </span>
            {bonusesUsed > bonusCount && (
              <span className="text-sm text-bad-400">
                ⚠️ Too many bonuses selected!
              </span>
            )}
          </div>
        </div>
      )}

      <div className="border border-line rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-950 sticky top-0 z-10">
              <tr className="text-left text-xs text-txt-low">
                <th className="p-3">Rank</th>
                {bonusCount > 0 && <th className="p-3">Bonus</th>}
                {/* Fija: al deslizar la tabla en horizontal, el jugador
                    sigue a la vista. z-20 = por encima de las otras
                    celdas Y del propio thead sticky (z-10). */}
                <th className="p-3 sticky left-0 z-20 bg-surface-950">Player</th>
                {visibleCols.th && <th className="p-3">TH</th>}
                {visibleCols.wars && <th className="p-3">Wars</th>}
                {visibleCols.missAtk && <th className="p-3">Miss Atk</th>}
                {activePage === "secondary" && visibleCols.missDef && (
                  <th className="p-3">Miss Def</th>
                )}
                {visibleCols.netStars && <th className="p-3">Net ★</th>}
                {visibleCols.netPercent && <th className="p-3">Net %</th>}
                {visibleCols.threeRate && <th className="p-3">3★%</th>}
                {visibleCols.starGain && <th className="p-3">★ Gain</th>}
                {visibleCols.percentGain && <th className="p-3">% Gain</th>}
                {visibleCols.starGive && <th className="p-3">★ Give</th>}
                {visibleCols.percentGive && <th className="p-3">% Give</th>}
                <th className="p-3">Stats</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={20} className="p-8 text-center text-txt-low">
                    No data
                  </td>
                </tr>
              ) : (
                data.map((p, i) => {
                  const hasBonus = selectedBonuses.includes(p.name);
                  
                  return (
                    <tr
                      key={i}
 className={`border-t border-line hover:bg-surface-700/30 ${
                        hasBonus ? "bg-amber-900/40" : ""
                      }`}
                    >
                      <td className="p-3">
                        <span
 className={`font-semibold ${
                            i < 3 ? "text-amber-400" : "text-txt-low"
                          }`}
                        >
                          #{i + 1}
                        </span>
                      </td>
                      
                      {/* Bonus Checkbox */}
                      {bonusCount > 0 && (
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={hasBonus}
                            onChange={() => onToggleBonus(p.name)}
                            disabled={!hasBonus && !canAddMore}
 className="w-4 h-4 rounded border-line-strong text-amber-400 focus:ring-amber-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                      )}
                      
                      <td
 className={`p-3 font-semibold sticky left-0 z-10 ${
                          hasBonus ? "bg-amber-900" : "bg-surface-950"
                        }`}
                      >
                        {p.name}
                      </td>
                      {visibleCols.th && <td className="p-3">{p.th}</td>}
                      {visibleCols.wars && (
                        <td className="p-3 tabular">{p.wars ?? "—"}</td>
                      )}
                      {visibleCols.missAtk && (
                        <td className="p-3">
                          {p.missAtk > 0 ? (
                            <span className="text-bad-400 font-semibold">
                              {p.missAtk}
                            </span>
                          ) : (
                            <span className="text-ok-400">✓</span>
                          )}
                        </td>
                      )}
                      {activePage === "secondary" && visibleCols.missDef && (
                        <td className="p-3">
                          {p.missDef > 0 ? (
                            <span className="text-orange-400 font-semibold">
                              {p.missDef}
                            </span>
                          ) : (
                            <span className="text-ok-400">✓</span>
                          )}
                        </td>
                      )}
                      {visibleCols.netStars && (
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <span
 className={`font-semibold ${
                                p.netStars >= 0
                                  ? "text-ok-400"
                                  : "text-bad-400"
                              }`}
                            >
                              {p.netStars >= 0 ? "+" : ""}
                              {p.netStars}
                            </span>
                            {p.avgDistance !== 0 && (
                              <span
 className={`text-xs ${
                                  p.avgDistance < 0
                                    ? "text-azure-400"
                                    : "text-orange-400"
                                }`}
                                title={`Avg Distance: ${p.avgDistance.toFixed(1)}`}
                              >
                                ({p.avgDistance > 0 ? "+" : ""}
                                {p.avgDistance.toFixed(1)})
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleCols.netPercent && (
                        <td className="p-3">
                          <span
 className={`font-semibold ${
                              p.netDest >= 0 ? "text-ok-400" : "text-bad-400"
                            }`}
                          >
                            {p.netDest >= 0 ? "+" : ""}
                            {p.netDest.toFixed(1)}%
                          </span>
                        </td>
                      )}
                      {visibleCols.threeRate && (
                        <td className="p-3 text-accent-400 font-semibold">
                          {p.threeRate.toFixed(1)}%
                        </td>
                      )}
                      {visibleCols.starGain && (
                        <td className="p-3 text-ok-400">{p.offStars}</td>
                      )}
                      {visibleCols.percentGain && (
                        <td className="p-3 text-ok-400">
                          {p.offDest.toFixed(1)}%
                        </td>
                      )}
                      {visibleCols.starGive && (
                        <td className="p-3 text-bad-400">{p.defStars}</td>
                      )}
                      {visibleCols.percentGive && (
                        <td className="p-3 text-bad-400">
                          {p.defDest.toFixed(1)}%
                        </td>
                      )}
                      <td className="p-3">
                        <button
                          onClick={() => onPlayerSelect(p)}
 className="text-txt-low hover:text-txt-low text-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
});

StatsTable.displayName = "StatsTable";

export default StatsTable;
