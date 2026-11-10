import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// El acento vive en una variable CSS (--accent-400) para poder cambiarlo
// desde Ajustes. Recharts necesita un color literal, asi que se lee del
// documento en tiempo de render.
const cssVar = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
  return v ? `rgb(${v})` : fallback;
};

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
    <div className="bg-surface-950 border border-line rounded-md p-3 text-sm">
      <p className="font-semibold text-accent-400 mb-1">{label}</p>
      <p className="text-txt-mid">{m?.label}: <span className="text-txt-hi font-semibold">{m?.format(payload[0].value)}</span></p>
    </div>
  );
};

const PlayerLineChart = ({ evolution, playerName }) => {
  const [metric, setMetric] = useState("threeRate");
  const currentMetric = METRICS.find(m => m.key === metric);

  if (!evolution || evolution.length < 2) {
    return (
      <div className="border border-line rounded-md p-6 text-center text-txt-low mb-6">
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
    <div className="border border-line rounded-md p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-lg">Evolution Chart</h3>
          <p className="text-sm text-txt-low">{playerName}</p>
        </div>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
 className="bg-surface-700 border border-line-strong rounded px-3 py-2 text-sm text-txt-hi"
        >
          {METRICS.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1f22" />
          <XAxis
            dataKey="season"
            tick={{ fill: "#6e7075", fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#6e7075", fontSize: 11 }}
            tickFormatter={currentMetric?.format}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <ReferenceLine
            y={avg}
            stroke={cssVar("accent-600", "#71882c")}
            strokeDasharray="4 4"
            label={{ value: `Avg: ${currentMetric?.format(avg)}`, fill: cssVar("accent-400", "#a8c74e"), fontSize: 11, position: "insideTopRight" }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={cssVar("accent-400", "#a8c74e")}
            strokeWidth={2}
            dot={{ fill: cssVar("accent-400", "#a8c74e"), r: 4 }}
            activeDot={{ r: 6, fill: cssVar("accent-300", "#c3dd74") }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PlayerLineChart;
