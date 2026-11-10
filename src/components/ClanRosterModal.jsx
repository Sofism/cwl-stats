import React from "react";
import { X } from "lucide-react";
import ClanPerformanceTable from "./ClanPerformanceTable";

/**
 * Popup con el roster y el rendimiento de un clan de la ronda actual
 * (el nuestro o el rival). Las stats son de las rondas TERMINADAS; la
 * ultima columna muestra el estado en la ronda en curso.
 */
const ClanRosterModal = ({ title, tag, players, state, attacksUsed, attacksTotal, roundsCompleted, onClose }) => {
  const left = attacksTotal - attacksUsed;

  return (
    <div
      className="fixed inset-0 bg-surface-950/95 z-50 overflow-y-auto p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="max-w-5xl mx-auto bg-surface-900 border border-line-strong rounded-md p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold text-txt-hi">{title}</h3>
            <p className="text-xs text-txt-low font-mono mt-1">{tag}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="px-3 py-2 bg-surface-700 rounded-md text-txt-hi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-txt-low mb-4">
          {state === "inWar" ? (
            <>
              <span className="text-txt-hi font-mono">{left}</span> of{" "}
              <span className="font-mono">{attacksTotal}</span> attacks left this round
              {" · "}
            </>
          ) : null}
          Stats cover {roundsCompleted} finished round{roundsCompleted === 1 ? "" : "s"}.
        </p>

        <ClanPerformanceTable players={players} state={state} />
      </div>
    </div>
  );
};

export default ClanRosterModal;
