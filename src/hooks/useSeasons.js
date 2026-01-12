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

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cwl-seasons");
      if (saved) {
        const parsedSeasons = JSON.parse(saved);
        setSeasons(parsedSeasons);
        if (parsedSeasons.length > 0) {
          setCurrentSeason(parsedSeasons[0]);
        }
      }
    } catch (err) {
      console.error("Error loading seasons:", err);
    }
    setLoading(false);
  }, []);

  const save = (updatedSeasons) => {
    if (isSharedMode) {
      setSaveStatus("⚠ Viewing shared data - changes not saved");
      setTimeout(() => setSaveStatus(""), 3000);
      return false;
    }
    
    try {
      localStorage.setItem("cwl-seasons", JSON.stringify(updatedSeasons));
      setSaveStatus("✓ Saved");
      setTimeout(() => setSaveStatus(""), 2000);
      return true;
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

  const deleteSeason = (seasonId) => {
    if (isSharedMode) return;
    
    const updated = seasons.filter((s) => s.id !== seasonId);
    setSeasons(updated);
    if (currentSeason && currentSeason.id === seasonId) {
      setCurrentSeason(updated[0] || null);
    }
    save(updated);
  };

  const deleteAllSeasons = () => {
    if (isSharedMode) return;
    
    localStorage.removeItem("cwl-seasons");
    setSeasons([]);
    setCurrentSeason(null);
  };

  const updateSeasonData = (updatedSeason) => {
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
    save(updatedSeasons);
  };

  return {
    seasons: isSharedMode ? sharedSeasons : seasons,
    currentSeason,
    setCurrentSeason,
    addSeason,
    deleteSeason,
    deleteAllSeasons,
    updateSeasonData,
    saveStatus,
    loading,
    getSeasonsByYear,
    loadSharedSeasons,
    isSharedMode,
  };
};
