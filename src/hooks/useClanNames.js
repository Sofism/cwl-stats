import { useState, useEffect } from "react";

const LOCAL_KEY = "cwl-clan-names";

const DEFAULTS = {
  main: "Main Clan",
  secondary: "Secondary Clan",
  mainTag: "",
  secondaryTag: "",
};

/**
 * Configuracion de clanes con doble almacenamiento:
 *  - Redis (via /api/clan-config): compartido entre dispositivos.
 *  - localStorage: cache local para que la app pinte al instante y siga
 *    funcionando si la API falla.
 * Redis manda cuando responde.
 */
export const useClanNames = () => {
  const [clanNames, setClanNames] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clan-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.config) return;
        const merged = { ...DEFAULTS, ...data.config };
        setClanNames(merged);
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
        } catch {
          // sin localStorage disponible: no pasa nada, Redis es la fuente
        }
      })
      .catch(() => {
        // Sin conexion con la API se sigue usando la cache local.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateClanNames = (newNames) => {
    const merged = { ...DEFAULTS, ...newNames };
    setClanNames(merged);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
    } catch {
      // ignorado a proposito
    }
    // Persistencia compartida; si falla, queda al menos la copia local.
    fetch("/api/clan-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: merged }),
    }).catch((err) => console.error("Error saving clan config:", err));
    return true;
  };

  return { clanNames, updateClanNames, loading };
};
