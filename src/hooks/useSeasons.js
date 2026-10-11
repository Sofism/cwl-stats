import { useState, useEffect, useRef } from "react";
import { writeHeaders } from "../utils/api";

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Cada clan de una temporada tiene su propio sello de "ultima modificacion"
// (mainAt / secondaryAt). El servidor fusiona por esos sellos, asi que un
// cliente con datos viejos no pisa lo que el sync automatico acaba de
// guardar. Aqui se sellan los clanes que HAN CAMBIADO respecto a la version
// anterior de la temporada (jugadores, liga o marca manual).
const stampSeason = (prev, next) => {
  const now = Date.now();
  const out = { ...next, updatedAt: now };
  [
    ["main", "mainClan", "mainAt"],
    ["secondary", "secondaryClan", "secondaryAt"],
  ].forEach(([key, players, at]) => {
    const changed =
      !prev ||
      !sameJson(prev[players], next[players]) ||
      !sameJson(prev.leagueInfo?.[key], next.leagueInfo?.[key]) ||
      !sameJson(prev.manual?.[key], next.manual?.[key]) ||
      !sameJson(prev.cwlComplete?.[key], next.cwlComplete?.[key]);
    if (changed) out[at] = now;
  });
  return out;
};

export const useSeasons = () => {
  const [seasons, setSeasons] = useState([]);
  const [sharedSeasons, setSharedSeasons] = useState([]); // Temporadas compartidas (solo lectura)
  const [currentSeason, setCurrentSeason] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSharedMode, setIsSharedMode] = useState(false);
  // Solo la respuesta del guardado MAS RECIENTE se adopta: si llegan dos
  // seguidas, la primera (ya vieja) no debe revertir lo que se acaba de editar.
  const saveSeq = useRef(0);

  // Obtener año de una temporada
  const getSeasonYear = (season) => {
    if (season.year) return season.year;
    const date = season.createdAt ? new Date(season.createdAt) : new Date();
    return date.getFullYear();
  };

  // Agrupar temporadas por año
  const getSeasonsByYear = () => {
    const grouped = {};
    const allSeasons = isSharedMode ? sharedSeasons : seasons;
    
    allSeasons.forEach(season => {
      const year = getSeasonYear(season);
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(season);
    });
    return grouped;
  };

  // Cargar temporadas compartidas (modo solo lectura)
  const loadSharedSeasons = (sharedData) => {
    setSharedSeasons(sharedData);
    setIsSharedMode(true);
    setLoading(false);
  };

  // Cargar desde API
  useEffect(() => {
    const loadSeasons = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/get-seasons');
        const data = await response.json();

        if (data.seasons && data.seasons.length > 0) {
          setSeasons(data.seasons);
          setCurrentSeason(data.seasons[0]);
        }
      } catch (err) {
        console.error('Failed to load seasons:', err);
        // Fallback a localStorage si falla la API
        try {
          const saved = localStorage.getItem("cwl-seasons");
          if (saved) {
            const parsedSeasons = JSON.parse(saved);
            setSeasons(parsedSeasons);
            if (parsedSeasons.length > 0) {
              setCurrentSeason(parsedSeasons[0]);
            }
          }
        } catch (localErr) {
          console.error("Error loading from localStorage:", localErr);
        }
      }
      setLoading(false);
    };

    loadSeasons();
  }, []);

  // El sync automatico del servidor puede crear o actualizar temporadas
  // mientras la app esta abierta: al volver a la pestaña se vuelve a leer la
  // lista. Solo se actualiza `seasons`, no la temporada abierta (su pantalla
  // tiene estado propio); y una respuesta vacia se ignora, nunca se confunde
  // con "no hay temporadas".
  useEffect(() => {
    if (isSharedMode) return undefined;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch('/api/get-seasons');
        const data = await response.json();
        if (Array.isArray(data.seasons) && data.seasons.length > 0) {
          setSeasons((prev) => (sameJson(prev, data.seasons) ? prev : data.seasons));
        }
      } catch (err) {
        // sin conexion: se queda con lo que hay
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [isSharedMode]);

  // Guardar en API. El servidor FUSIONA y devuelve la lista resultante.
  const save = async (updatedSeasons) => {
    if (isSharedMode) {
      setSaveStatus("⚠ Viewing shared data - changes not saved");
      setTimeout(() => setSaveStatus(""), 3000);
      return false;
    }

    const seq = ++saveSeq.current;
    try {
      const response = await fetch('/api/save-season', {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify({ seasons: updatedSeasons })
      });

      const result = await response.json();

      if (result.success) {
        if (seq === saveSeq.current && Array.isArray(result.seasons)) {
          setSeasons(result.seasons);
          setCurrentSeason((cur) =>
            cur ? result.seasons.find((s) => s.id === cur.id) || cur : cur
          );
        }
        setSaveStatus("✓ Saved");
        setTimeout(() => setSaveStatus(""), 2000);
        return true;
      } else {
        setSaveStatus(response.status === 401 ? "✗ Not authorized" : "✗ Failed");
        return false;
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("✗ Failed");
      return false;
    }
  };

  const addSeason = (name, year) => {
    if (isSharedMode) return null;
    
    const newSeason = {
      id: Date.now().toString(),
      name: name.trim(),
      year: year || new Date().getFullYear(),
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      mainClan: [],
      secondaryClan: [],
      leagueInfo: {
        main: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
        secondary: { league: "Crystal I", position: 1, warsWon: 0, warSize: 15 },
      },
    };
    const updated = [newSeason, ...seasons];
    setSeasons(updated);
    setCurrentSeason(newSeason);
    save(updated);
    return newSeason;
  };

  // El borrado va por su propio endpoint (borra UNA temporada en el
  // servidor, tras guardar una copia de seguridad), no filtrando la lista
  // local y guardandola: ese camino, con la lista aun sin cargar, vacio las
  // 12 temporadas de golpe.
  const deleteSeason = async (seasonId) => {
    if (isSharedMode) return;

    try {
      const response = await fetch(`/api/delete-season?id=${encodeURIComponent(seasonId)}`, {
        method: 'DELETE',
        headers: writeHeaders(),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setSaveStatus(response.status === 401 ? "✗ Not authorized" : "✗ Failed to delete");
        setTimeout(() => setSaveStatus(""), 3000);
        return;
      }
      setSeasons(result.seasons);
      if (currentSeason && currentSeason.id === seasonId) {
        setCurrentSeason(result.seasons[0] || null);
      }
      setSaveStatus("✓ Deleted");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error("Delete error:", err);
      setSaveStatus("✗ Failed to delete");
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  const deleteAllSeasons = async () => {
    if (isSharedMode) return;
    
    try {
      const response = await fetch('/api/delete-season?all=1', {
        method: 'DELETE',
        headers: writeHeaders(),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      setSeasons([]);
      setCurrentSeason(null);
      setSaveStatus("✓ All deleted");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error('Delete all error:', err);
      setSaveStatus("✗ Failed to delete");
    }
  };

  const updateSeasonData = async (updatedSeason) => {
    if (isSharedMode) {
      // En modo compartido, actualizar solo localmente sin guardar
      const updatedShared = sharedSeasons.map((s) =>
        s.id === updatedSeason.id ? updatedSeason : s
      );
      setCurrentSeason(updatedSeason);
      setSharedSeasons(updatedShared);
      setSaveStatus("⚠ Viewing shared data - changes not saved");
      setTimeout(() => setSaveStatus(""), 3000);
      return;
    }

    const previous = seasons.find((s) => s.id === updatedSeason.id);
    const stamped = stampSeason(previous, updatedSeason);
    const updatedSeasons = seasons.map((s) => (s.id === stamped.id ? stamped : s));
    setCurrentSeason(stamped);
    setSeasons(updatedSeasons);
    await save(updatedSeasons);
  };

  const reorderSeasons = async (newOrder) => {
    if (isSharedMode) return;

    setSeasons(newOrder);
    await save(newOrder);
  };

  return {
    seasons: isSharedMode ? sharedSeasons : seasons,
    currentSeason,
    setCurrentSeason,
    addSeason,
    deleteSeason,
    deleteAllSeasons,
    updateSeasonData,
    reorderSeasons,
    saveStatus,
    loading,
    getSeasonsByYear,
    loadSharedSeasons,
    isSharedMode,
  };
};
