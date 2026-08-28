import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

const METRICS = [
  { key: "threeRate", label: "3★%", format: (v) => `${v.toFixed(1)}%` },
  { key: "netStars", label: "Net ★", format: (v) => `${v >= 0 ? "+" : ""}${v}` },
  { key: "totalMissAtk", label: "Miss Atk", format: (v) => v, inverted: true },
  { key: "netDest", label: "Net %", format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
];

const getColor = (value, metric, data) => {
  const values = data.map(d => d[metric]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const normalized = (value - min) / range;

  if (metric === "totalMissAtk") {
    if (value === 0) return "#4ade80";
    if (value <= 1) return "#facc15";
    return "#f87171";
  }

  if (normalized >= 0.66) return "#4ade80";
  if (normalized >= 0.33) return "#facc15";
  return "#f87171";
};

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const m = METRICS.find(m => m.key === metric);
  return (
    <div className="bg-void-950 border border-void-700 rounded-lg p-3 text-sm">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-signal-400">{m?.label}: <span className="text-white font-semibold">{m?.format(payload[0].value)}</span></p>
    </div>
  );
};

const PlayerBarChart = ({ data }) => {
  const [metric, setMetric] = useState("threeRate");
  const currentMetric = METRICS.find(m => m.key === metric);

  const chartData = [...data]
    .sort((a, b) => {
      if (metric === "totalMissAtk") return a[metric] - b[metric];
      return b[metric] - a[metric];
    })
    .map(p => ({
      name: p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name,
      fullName: p.name,
      [metric]: parseFloat((p[metric] || 0).toFixed(2)),
    }));

  return (
    <div className="bg-void-800 border border-void-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-lg">Player Comparison</h3>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="bg-void-700 border border-void-600 rounded px-3 py-2 text-sm text-white"
        >
          {METRICS.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={currentMetric?.format}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getColor(entry[metric], metric, chartData)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-4 justify-center mt-2 text-xs text-ink-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Top</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Mid</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Low</span>
      </div>
    </div>
  );
};

export default PlayerBarChart;
