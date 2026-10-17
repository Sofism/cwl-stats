import React from "react";

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(
    raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")
  );
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const RESULT = {
  win: { label: "WIN", tone: "text-ok-400 border-ok-400" },
  lose: { label: "LOSS", tone: "text-bad-400 border-bad-400" },
  tie: { label: "TIE", tone: "text-txt-low border-line-strong" },
};

/**
 * Resumen de una guerra de la que NO hay datos por jugador, a partir del
 * historial oficial de Clash (que solo guarda totales de guerras terminadas).
 * `captured` (opcional): ataques que SI se capturaron, para guerras parciales.
 */
const NormalWarOfficialSummary = ({ item, ourName, captured }) => {
  const r = RESULT[item.result] || RESULT.tie;
  const possible = item.teamSize * item.attacksPerMember;
  return (
    <div className="border border-line rounded-md p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${r.tone}`}>{r.label}</span>
        <span className="text-xs text-txt-dim">
          {fmtDate(item.endTime)} · {item.teamSize}v{item.teamSize} · {item.attacksPerMember} attacks each
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center mb-4">
        <div>
          <div className="text-sm text-txt-mid truncate">{ourName}</div>
          <div className="font-mono text-2xl font-semibold text-txt-hi">{item.us.stars}★</div>
          <div className="font-mono text-xs text-txt-low">{Number(item.us.destruction).toFixed(1)}%</div>
        </div>
        <div className="text-txt-dim text-sm">vs</div>
        <div>
          <div className="text-sm text-txt-mid truncate">{item.them?.name || "Unknown"}</div>
          <div className="font-mono text-2xl font-semibold text-txt-hi">{item.them.stars}★</div>
          <div className="font-mono text-xs text-txt-low">{Number(item.them.destruction).toFixed(1)}%</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-txt-low border-t border-line pt-3">
        {item.us.attacks != null && (
          <span>
            Attacks used: <span className="font-mono text-txt-mid">{item.us.attacks}</span> of{" "}
            <span className="font-mono text-txt-mid">{possible}</span>
          </span>
        )}
        {item.us.expEarned != null && (
          <span>
            Clan XP: <span className="font-mono text-txt-mid">{item.us.expEarned}</span>
          </span>
        )}
      </div>

      <p className="text-xs text-txt-dim mt-3">
        {captured != null
          ? `Only ${captured} of the ${item.us.attacks ?? "?"} attacks used in this war were captured. These totals come from Clash's official war log.`
          : "No player-level data was captured for this war. Clash only keeps these totals once a war is over, so it cannot be recovered."}
      </p>
    </div>
  );
};

export default NormalWarOfficialSummary;
