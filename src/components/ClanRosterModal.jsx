import React from "react";
import { X } from "lucide-react";
import ClanPerformanceTable from "./ClanPerformanceTable";
import { useCwlClanView } from "../utils/useCwlClanView";

/**
 * Popup con el roster y el rendimiento de un clan de la ronda abierta (el
 * nuestro o el rival). Las stats son de las rondas TERMINADAS; la ultima
 * columna muestra el estado en la ronda en curso.
 */
const ClanRosterModal = ({
  viewerTag,
  clanTag,
  clanName,
  round,
  roundState,
  attacksLeft,
  attacksTotal,
  refreshToken,
  onClose,
}) => {
  const { loading, error, data } = useCwlClanView(viewerTag, clanTag, round, true, refreshToken);

  return (
    <div
      className="fixed inset-0 bg-surface-950/95 z-[60] overflow-y-auto p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="max-w-5xl mx-auto bg-surface-900 border border-line-strong rounded-md p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold text-txt-hi">{clanName}</h3>
            <p className="text-xs text-txt-low font-mono mt-1">{clanTag}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="px-3 py-2 bg-surface-700 rounded-md text-txt-hi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && !data && (
          <div className="border border-line rounded-md p-8 text-center text-txt-low">
            Loading players…
          </div>
        )}
        {error && !loading && (
          <div className="bg-amber-900 border border-amber-400/30 rounded-md p-4 text-yellow-200 text-sm">
            {error}
          </div>
        )}

        {data && (
          <>
            <p className="text-sm text-txt-low mb-4">
              {roundState === "inWar" && attacksTotal != null ? (
                <>
                  <span className="text-txt-hi font-mono">{attacksLeft}</span> of{" "}
                  <span className="font-mono">{attacksTotal}</span> attacks left this round
                  {" · "}
                </>
              ) : null}
              Stats cover {data.roundsCompleted} finished round
              {data.roundsCompleted === 1 ? "" : "s"}.
            </p>
            <ClanPerformanceTable players={data.players} state={roundState} />
          </>
        )}
      </div>
    </div>
  );
};

export default ClanRosterModal;
