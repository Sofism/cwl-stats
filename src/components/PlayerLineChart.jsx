import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const METRICS = [
  { key: "threeRate", label: "3★%", format: (v) => `${v.toFixed(1)}%` },
  { key: "netStars", label: "Net ★", format: (v) => `${v >= 0 ? "+" : ""}${v}` },
  { key: "missAtk", label: "Miss Atk", format: (v) => v },
  { key: "netDest", label: "Net %", format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
  { key: "offStars", label: "★ Gained", format: (v) => v },
];

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const m = METRICS.find(m => m.key === metric);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm">
      <p className="font-bold text-purple-400 mb-1">{label}</p>
      <p className="text-gray-300">{m?.label}: <span className="text-white font-semibold">{m?.format(payload[0].value)}</span></p>
    </div>
  );
};

const PlayerLineChart = ({ evolution, playerName }) => {
  const [metric, setMetric] = useState("threeRate");
  const currentMetric = METRICS.find(m => m.key === metric);

  if (!evolution || evolution.length < 2) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center text-gray-400 mb-6">
        Need at least 2 seasons to show evolution chart.
      </div>
    );
  }

  const chartData = evolution.map(s => ({
    season: s.season.length > 8 ? s.season.slice(0, 8) + "…" : s.season,
    fullSeason: s.season,
    [metric]: parseFloat((s[metric] || 0).toFixed(2)),
  }));

  const avg = chartData.reduce((s, d) => s + d[metric], 0) / chartData.length;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-lg">Evolution Chart</h3>
          <p className="text-sm text-gray-400">{playerName}</p>
        </div>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
        >
          {METRICS.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="season"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={currentMetric?.format}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <ReferenceLine
            y={avg}
            stroke="#6366f1"
            strokeDasharray="4 4"
            label={{ value: `Avg: ${currentMetric?.format(avg)}`, fill: "#818cf8", fontSize: 11, position: "insideTopRight" }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ fill: "#a855f7", r: 4 }}
            activeDot={{ r: 6, fill: "#d946ef" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PlayerLineChart;
