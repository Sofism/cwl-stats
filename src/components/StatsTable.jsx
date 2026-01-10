import React, { memo } from "react";
import { AlertCircle } from "lucide-react";

const StatsTable = memo(({ data, visibleCols, activePage, onPlayerSelect }) => {
  return (
    <>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-1">Missed Defences Correction:</p>
            <p>
              When a player misses a defence, the system adds{" "}
              <span className="font-bold">+2 stars</span> and{" "}
              <span className="font-bold">+85%</span> to defensive stats for
              fair ranking.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div
          className="overflow-x-auto"
          style={{ maxHeight: "600px", overflowY: "auto" }}
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-900 sticky top-0 z-10">
              <tr className="text-left text-xs text-gray-400">
                <th className="p-3">Rank</th>
                <th className="p-3">Player</th>
                {visibleCols.th && <th className="p-3">TH</th>}
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
                  <td colSpan={20} className="p-8 text-center text-gray-400">
                    No data
                  </td>
                </tr>
              ) : (
                data.map((p, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-700 hover:bg-gray-700/30 ${
                      p.getsBonus ? "bg-yellow-500/10" : ""
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            i < 3 ? "text-yellow-400" : "text-gray-400"
                          }`}
                        >
                          #{i + 1}
                        </span>
                        {p.getsBonus && (
                          <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">
                            BONUS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold">{p.name}</td>
                    {visibleCols.th && <td className="p-3">{p.th}</td>}
                    {visibleCols.missAtk && (
                      <td className="p-3">
                        {p.missAtk > 0 ? (
                          <span className="text-red-400 font-bold">
                            {p.missAtk}
                          </span>
                        ) : (
                          <span className="text-green-400">✓</span>
                        )}
                      </td>
                    )}
                    {activePage === "secondary" && visibleCols.missDef && (
                      <td className="p-3">
                        {p.missDef > 0 ? (
                          <span className="text-orange-400 font-bold">
                            {p.missDef}
                          </span>
                        ) : (
                          <span className="text-green-400">✓</span>
                        )}
                      </td>
                    )}
                    {visibleCols.netStars && (
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span
                            className={`font-bold ${
                              p.netStars >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {p.netStars >= 0 ? "+" : ""}
                            {p.netStars}
                          </span>
                          {p.avgDistance !== 0 && (
                            <span
                              className={`text-xs ${
                                p.avgDistance < 0
                                  ? "text-cyan-400"
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
                          className={`font-bold ${
                            p.netDest >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {p.netDest >= 0 ? "+" : ""}
                          {p.netDest.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {visibleCols.threeRate && (
                      <td className="p-3 text-purple-400 font-semibold">
                        {p.threeRate.toFixed(1)}%
                      </td>
                    )}
                    {visibleCols.starGain && (
                      <td className="p-3 text-green-400">{p.offStars}</td>
                    )}
                    {visibleCols.percentGain && (
                      <td className="p-3 text-green-400">
                        {p.offDest.toFixed(1)}%
                      </td>
                    )}
                    {visibleCols.starGive && (
                      <td className="p-3 text-red-400">{p.defStars}</td>
                    )}
                    {visibleCols.percentGive && (
                      <td className="p-3 text-red-400">
                        {p.defDest.toFixed(1)}%
                      </td>
                    )}
                    <td className="p-3">
                      <button
                        onClick={() => onPlayerSelect(p)}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
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
