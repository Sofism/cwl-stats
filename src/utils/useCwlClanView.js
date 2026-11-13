import { useEffect, useState } from "react";
import { getCwlClanView } from "./cwlSync";

/**
 * Carga los jugadores de un clan del grupo de CWL (stats acumuladas + estado
 * en la ronda `round`). `refreshToken` cambia cuando la vista padre vuelve a
 * descargar el grupo, para recargar tambien esto. No hace peticiones nuevas
 * a la API: getCwlClanView comparte la cache de getCwlRounds.
 */
export const useCwlClanView = (viewerTag, targetTag, round, enabled, refreshToken) => {
  const [state, setState] = useState({ loading: false, error: null, data: null });

  useEffect(() => {
    if (!enabled || !viewerTag || !targetTag || !round) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getCwlClanView(viewerTag, targetTag, round)
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ loading: false, error: err.message || "Could not load players.", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [viewerTag, targetTag, round, enabled, refreshToken]);

  return state;
};
