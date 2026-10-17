import React from "react";

/** ★★☆: estrellas conseguidas en ambar, las que faltan apagadas. */
export const Stars = ({ n }) => (
  <span className="font-mono tracking-tight whitespace-nowrap">
    {[1, 2, 3].map((i) => (
      <span key={i} className={i <= n ? "text-amber-400" : "text-txt-dim"}>
        ★
      </span>
    ))}
  </span>
);

/**
 * Log cronologico de TODOS los ataques de una guerra (los dos bandos), en el
 * orden en que se hicieron. Cada fila: numero de ataque, bando, atacante ->
 * defensor, estrellas y %, y si fue el primer golpe a esa base ("clean") o
 * un repaso ("cleanup"). Los nombres de NUESTROS jugadores abren su ficha.
 */
const NormalWarTimeline = ({ events, hasOrder, ourTags, selectedKey, onSelectPlayer }) => {
  if (events.length === 0) {
    return (
      <div className="border border-line rounded-md p-6 text-center text-txt-low text-sm">
        No attacks match these filters.
      </div>
    );
  }

  const Name = ({ player, ours }) => {
    const key = player.tag || player.name;
    const selected = selectedKey && key === selectedKey;
    return ours ? (
      <button
        onClick={() => onSelectPlayer(key)}
        className={`font-semibold hover:text-accent-400 text-left ${selected ? "text-accent-400" : "text-txt-hi"}`}
        title="Open this player's card"
      >
        {player.name}
      </button>
    ) : (
      <span className="text-txt-mid">{player.name}</span>
    );
  };

  return (
    <div className="border border-line rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-950 text-txt-low">
            <tr className="text-left">
              <th className="p-3 w-12">#</th>
              <th className="p-3">Attacker</th>
              <th className="p-3">Defender</th>
              <th className="p-3 text-center">Result</th>
              <th className="p-3 text-center">Hit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e, i) => {
              const ours = e.side === "us";
              const attackerOurs = ours && ourTags.has(e.attacker.tag);
              const defenderOurs = !ours && ourTags.has(e.defender.tag);
              return (
                <tr key={`${e.order ?? "x"}-${i}`} className="hover:bg-surface-700/30">
                  <td className="p-3 font-mono text-txt-dim">{hasOrder ? e.order : "·"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block text-[10px] font-semibold uppercase tracking-wide mr-2 px-1.5 py-0.5 rounded border ${
                        ours ? "border-accent-400 text-accent-400" : "border-bad-400 text-bad-400"
                      }`}
                    >
                      {ours ? "us" : "them"}
                    </span>
                    <Name player={e.attacker} ours={attackerOurs} />
                    <span className="ml-2 text-xs text-txt-dim">TH{e.attackerTh ?? e.attacker.th ?? "?"}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-txt-dim mr-2">→</span>
                    <Name player={e.defender} ours={defenderOurs} />
                    <span className="ml-2 text-xs text-txt-dim">TH{e.defender.th ?? "?"}</span>
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <Stars n={e.stars} />
                    <span className="ml-2 font-mono text-xs text-txt-low">{e.destruction}%</span>
                  </td>
                  <td className="p-3 text-center text-xs">
                    {e.fresh ? (
                      <span className="text-ok-400">clean</span>
                    ) : (
                      <span className="text-txt-dim">cleanup</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NormalWarTimeline;
