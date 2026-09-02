import React from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Se muestra cuando un sync traeria MENOS jugadores de los que ya habia
 * guardados para esa temporada — tipico al empezar una CWL nueva antes de
 * que termine la primera ronda (0 rondas jugadas todavia). Sin esto, un
 * sync en el momento equivocado borra datos reales sin avisar.
 */
const SyncReduceConfirmModal = ({
  clanNames,
  mainWouldReduce,
  secondaryWouldReduce,
  mainOld,
  mainNew,
  secondaryOld,
  secondaryNew,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-surface-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-800 border border-bad-400/40 rounded-md p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4 text-bad-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          This sync would remove data
        </h3>
        <div className="space-y-2 mb-6 text-sm text-txt-mid">
          {mainWouldReduce && (
            <p>
              <span className="font-semibold text-txt-hi">{clanNames?.main || "Main"}</span>:{" "}
              {mainOld} → {mainNew} players.
            </p>
          )}
          {secondaryWouldReduce && (
            <p>
              <span className="font-semibold text-txt-hi">{clanNames?.secondary || "Secondary"}</span>:{" "}
              {secondaryOld} → {secondaryNew} players.
            </p>
          )}
          <p className="text-txt-low">
            Usually means a new CWL round has started but hasn't finished yet —
            wait until it ends and sync again, or confirm to overwrite anyway.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-bad-900 border border-bad-400/40 hover:bg-bad-900 text-txt-hi font-semibold py-2 rounded transition-colors"
          >
            Overwrite anyway
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-surface-700 hover:bg-surface-700 text-txt-hi font-semibold py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncReduceConfirmModal;
