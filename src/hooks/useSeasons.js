import { useState, useEffect } from "react";

export const useSeasons = () => {
  const [seasons, setSeasons] = useState([]);
  const [sharedSeasons, setSharedSeasons] = useState([]); // Temporadas compartidas (solo lectura)
  const [currentSeason, setCurrentSeason] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSharedMode, setIsSharedMode] = useState(false);

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

  // Guardar en API
  const save = async (updatedSeasons) => {
    if (isSharedMode) {
      setSaveStatus("⚠ Viewing shared data - changes not saved");
      setTimeout(() => setSaveStatus(""), 3000);
      return false;
    }
    
    try {
      const response = await fetch('/api/save-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasons: updatedSeasons })
      });

      const result = await response.json();

      if (result.success) {
        setSaveStatus("✓ Saved");
        setTimeout(() => setSaveStatus(""), 2000);
        return true;
      } else {
        setSaveStatus("✗ Failed");
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
      mainClan: [],
      secondaryClan: [],
      leagueInfo: {
        main: { league: "Crystal I", position: 1, warsWon: 0 },
        secondary: { league: "Crystal I", position: 1, warsWon: 0 },
      },
    };
    const updated = [newSeason, ...seasons];
    setSeasons(updated);
    setCurrentSeason(newSeason);
    save(updated);
    return newSeason;
  };

  const deleteSeason = async (seasonId) => {
    if (isSharedMode) return;
    
    const updated = seasons.filter((s) => s.id !== seasonId);
    setSeasons(updated);
    if (currentSeason && currentSeason.id === seasonId) {
      setCurrentSeason(updated[0] || null);
    }
    await save(updated);
  };

  const deleteAllSeasons = async () => {
    if (isSharedMode) return;
    
    try {
      await fetch('/api/delete-season', { method: 'DELETE' });
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
    
    const updatedSeasons = seasons.map((s) =>
      s.id === updatedSeason.id ? updatedSeason : s
    );
    setCurrentSeason(updatedSeason);
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
