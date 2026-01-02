
// ============================================
// components/PlayerModal.jsx
// ============================================
import React from "react";

const PlayerModal = ({ player, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-4xl w-full my-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">{player.name}</h2>
              <p className="text-gray-400">
                TH{player.th} • {player.clan}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none -mt-2"
            >
              &times;
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-400">
                {player.offStars}
              </p>
              <p className="text-sm text-gray-400 mt-1">Stars Gained</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-red-400">
                {player.defStars}
              </p>
              <p className="text-sm text-gray-400 mt-1">Stars Given</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <p
                className={`text-3xl font-bold ${
                  player.netStars >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {player.netStars >= 0 ? "+" : ""}
                {player.netStars}
              </p>
              <p className="text-sm text-gray-400 mt-1">Net Stars</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-purple-400">
                {player.threeRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400 mt-1">3-Star Rate</p>
            </div>
          </div>

          <div className="bg-gray-900 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-yellow-400 mb-4">
              Attack Distribution
            </h3>
            <div className="space-y-3">
              {[
                { stars: 3, count: player.stars3, color: "bg-yellow-400", label: "3 Stars" },
                { stars: 2, count: player.stars2, color: "bg-orange-400", label: "2 Stars" },
                { stars: 1, count: player.stars1, color: "bg-red-400", label: "1 Star" },
                { stars: 0, count: player.stars0, color: "bg-gray-600", label: "0 Stars" },
              ].map(({ stars, count, color, label }) => {
                const total = player.wars - player.missAtk;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={stars}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{label}</span>
                      <span className="text-white font-semibold">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${color}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900 p-4 rounded-lg">
              <h3 className="font-semibold text-green-400 mb-3">
                Offensive Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Stars:</span>
                  <span className="text-white font-semibold">
                    {player.offStars}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Destruction:</span>
                  <span className="text-white font-semibold">
                    {player.offDest.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Wars Participated:</span>
                  <span className="text-white font-semibold">{player.wars}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Missed Attacks:</span>
                  <span
                    className={
                      player.missAtk > 0
                        ? "text-red-400 font-bold"
                        : "text-green-400 font-semibold"
                    }
                  >
                    {player.missAtk > 0 ? player.missAtk : "0 ✓"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h3 className="font-semibold text-red-400 mb-3">
                Defensive Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Stars Conceded:</span>
                  <span className="text-white font-semibold">
                    {player.defStars}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Destruction Taken:</span>
                  <span className="text-white font-semibold">
                    {player.defDest.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Defenses:</span>
                  <span className="text-white font-semibold">
                    {player.wars - player.missDef}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Missed Defenses:</span>
                  <span
                    className={
                      player.missDef > 0
                        ? "text-orange-400 font-bold"
                        : "text-green-400 font-semibold"
                    }
                  >
                    {player.missDef > 0 ? player.missDef : "0 ✓"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-blue-400 mb-3">
              Performance Metrics
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Net Stars</span>
                  <span
                    className={
                      player.netStars >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {player.netStars >= 0 ? "+" : ""}
                    {player.netStars}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      player.netStars >= 0 ? "bg-green-400" : "bg-red-400"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.abs(player.netStars) * 10)}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Net Destruction</span>
                  <span
                    className={
                      player.netDest >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {player.netDest >= 0 ? "+" : ""}
                    {player.netDest.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      player.netDest >= 0 ? "bg-green-400" : "bg-red-400"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.abs(player.netDest))}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">3-Star Rate</span>
                  <span className="text-purple-400">
                    {player.threeRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-purple-400"
                    style={{ width: `${player.threeRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerModal;
