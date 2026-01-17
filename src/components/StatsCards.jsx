import React from "react";
import { Target, Shield, Trophy, Award } from "lucide-react";

const StatsCards = ({ data, leagueInfo, activePage, bonusCount }) => {
  const cards = [
    {
      icon: Target,
      value: data.length,
      label: "Total Players",
      colorClass: "text-green-400",
    },
    {
      icon: Shield,
      value: data.filter((p) => p.missAtk > 0).length,
      label: "Missed Attacks",
      colorClass: "text-red-400",
    },
    {
      icon: Trophy,
      value: `${
        data.length > 0
          ? (data.reduce((s, p) => s + p.threeRate, 0) / data.length).toFixed(1)
          : 0
      }%`,
      label: "Avg 3★ Rate",
      colorClass: "text-purple-400",
    },
    {
      icon: Award,
      value: bonusCount, // ← Usa el prop directamente
      label: "Bonus Recipients",
      colorClass: "text-yellow-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(({ icon: Icon, value, label, colorClass }, i) => (
        <div
          key={i}
          className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center"
        >
          <Icon className={`w-8 h-8 ${colorClass} mx-auto mb-3`} />
          <p className={`text-3xl font-bold mb-1 ${colorClass}`}>{value}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
