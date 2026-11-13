import React, { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { comparePlayers, sameOrHigherTh } from "../utils/sortPlayers";

// Valor por el que se ordena cada columna al pulsar su cabecera.
const SORT_VALUE = {
  th: (p) => p.th || 0,
  name: (p) => (p.name || "").toLowerCase(),
  wars: (p) => p.wars || 0,
  stars3: (p) => p.stars3 || 0,
  stars2: (p) => p.stars2 || 0,
  stars1: (p) => p.stars1 || 0,
  stars0: (p) => p.stars0 || 0,
  missAtk: (p) => p.missAtk || 0,
  hits: (p) => sameOrHigherTh(p),
  defCount: (p) => p.defCount || 0,
  round: (p) => (p.thisRound ? p.thisRound.position : 999),
};

// Primer clic: lo "bueno" arriba. Para Missed eso significa los que mas
// fallan arriba (es el uso pedido: encontrar rapido a quien falla).
const FIRST_DIR = { name: "asc", round: "asc" };

const StarRow = ({ stars }) => (
  <span className="text-amber-400 tracking-tight">
    {"★".repeat(stars)}
    <span className="text-txt-dim">{"★".repeat(3 - stars)}</span>
  </span>
);

const thDiffLabel = (attackerTh, targetTh) => {
  const d = attackerTh - targetTh;
  if (d === 0) return "same TH";
  return `${d > 0 ? "+" : "−"}${Math.abs(d)} TH`;
};

const ClanPerformanceTable = ({ players, state }) => {
  const [sort, setSort] = useState(null); // null = orden por defecto
  const [open, setOpen] = useState(() => new Set());

  const rows = useMemo(() => {
    if (!sort) return players; // ya viene en el orden por defecto
    const get = SORT_VALUE[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...players].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return comparePlayers(a, b);
    });
  }, [players, sort]);

  const onSort = (key) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) {
        return { key, dir: FIRST_DIR[key] || "desc" };
      }
      return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
    });
  };

  const toggle = (tag) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const Th = ({ k, children, className = "text-center", title }) => {
    const active = sort && sort.key === k;
    return (
      <th className={`p-3 font-medium ${className}`} title={title}>
        <button
          onClick={() => onSort(k)}
          className={`inline-flex items-center gap-1 hover:text-txt-hi ${
            active ? "text-accent-400" : ""
          }`}
        >
          {children}
          {active && <span className="text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
        </button>
      </th>
    );
  };

  const roundCell = (p) => {
    if (!p.thisRound) return <span className="text-txt-dim">—</span>;
    const { position, attack } = p.thisRound;
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-txt-low font-mono">#{position}</span>
        {attack ? (
          <>
            <StarRow stars={attack.stars} />
            <span className="text-txt-low text-xs font-mono">{attack.destruction}%</span>
          </>
        ) : state === "inWar" ? (
          <span className="text-amber-400 text-xs">pending</span>
        ) : null}
      </span>
    );
  };

  return (
    <div className="border border-line rounded-md overflow-hidden">
      {sort && (
        <div className="flex items-center justify-between px-3 py-2 bg-surface-950 border-b border-line text-xs text-txt-low">
          <span>Custom order</span>
          <button
            onClick={() => setSort(null)}
            className="text-accent-400 hover:underline"
          >
            Back to default order
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-950 text-txt-low text-xs">
            <tr>
              <th className="p-3 w-8"></th>
              <Th k="th" title="Town Hall level">TH</Th>
              <Th k="name" className="text-left">Player</Th>
              <Th k="wars" title="Finished rounds played">Wars</Th>
              <Th k="stars3">3★</Th>
              <Th k="stars2">2★</Th>
              <Th k="stars1">1★</Th>
              <Th k="stars0">0★</Th>
              <Th k="missAtk" title="Finished rounds with no attack">Missed</Th>
              <Th k="hits" title="Attacks on the same or a higher TH than their own">Hits ≥ TH</Th>
              <Th k="defCount" title="Defences faced in finished rounds">Def</Th>
              <Th k="round" className="text-left" title="Status in the current round">
                This round
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-6 text-center text-txt-low">
                  No players yet
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const isOpen = open.has(p.tag);
                const hasDetail = (p.defenseLog || []).length > 0 || p.missDef > 0;
                return (
                  <React.Fragment key={p.tag}>
                    <tr
                      onClick={() => hasDetail && toggle(p.tag)}
                      className={`border-t border-line ${
                        hasDetail ? "cursor-pointer hover:bg-surface-700/30" : ""
                      }`}
                    >
                      <td className="p-3 text-txt-low">
                        {hasDetail &&
                          (isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          ))}
                      </td>
                      <td className="p-3 text-center font-mono text-txt-low">{p.th || "—"}</td>
                      <td className="p-3 font-semibold text-txt-hi">{p.name}</td>
                      <td className="p-3 text-center font-mono">{p.wars}</td>
                      <td className="p-3 text-center font-mono text-txt-hi">{p.stars3}</td>
                      <td className="p-3 text-center font-mono">{p.stars2}</td>
                      <td className="p-3 text-center font-mono">{p.stars1}</td>
                      <td className="p-3 text-center font-mono text-txt-low">{p.stars0}</td>
                      <td className="p-3 text-center font-mono">
                        {p.missAtk > 0 ? (
                          <span className="text-bad-400 font-semibold">{p.missAtk}</span>
                        ) : (
                          <span className="text-txt-dim">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-txt-mid">
                        {sameOrHigherTh(p)}
                      </td>
                      <td className="p-3 text-center font-mono text-txt-low">
                        {p.defCount || 0}
                      </td>
                      <td className="p-3">{roundCell(p)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface-900">
                        <td></td>
                        <td colSpan={11} className="px-3 pb-3 pt-1">
                          <p className="text-xs text-txt-low mb-2">Defences faced</p>
                          <div className="space-y-1">
                            {(p.defenseLog || []).map((d, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <StarRow stars={d.stars} />
                                <span className="font-mono text-txt-mid w-12">
                                  {d.destruction}%
                                </span>
                                <span className="text-txt-low">
                                  by #{d.attackerPosition} {d.attackerName} · TH{d.attackerTh}{" "}
                                  ({thDiffLabel(d.attackerTh, d.targetTh)})
                                </span>
                              </div>
                            ))}
                            {p.missDef > 0 && (
                              <p className="text-xs text-txt-low">
                                Not attacked in {p.missDef} round{p.missDef > 1 ? "s" : ""} —
                                counted as 2★ / 85% in the season stats.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClanPerformanceTable;
