import { useState, useEffect } from "react";

export const useSeasons = () => {
  const [seasons, setSeasons] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // Obtener año de una temporada
  const getSeasonYear = (season) => {
    if (season.year) return season.year;
    // Inferir del nombre o fecha de creación
    const date = season.createdAt ? new Date(season.createdAt) : new Date();
    return date.getFullYear();
  };

  // Agrupar temporadas por año
  const getSeasonsByYear = () => {
    const grouped = {};
    seasons.forEach(season => {
      const year = getSeasonYear(season);
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(season);
    });
    return grouped;
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
    const newSeason = {
      id: Date.now().toString(),
      name: name.trim(),
      year: year || new Date().getFullYear(), // Agregar año
      createdAt: new Date().toISOString(),
      mainClan: [],
      secondaryClan: [],
      leagueInfo: {
        main: { league: "Crystal I", position: 1 },
        secondary: { league: "Crystal I", position: 1 },
      },
    };
    const updated = [newSeason, ...seasons];
    setSeasons(updated);
    setCurrentSeason(newSeason);
    save(updated);
    return newSeason;
  };

  const deleteSeason = (seasonId) => {
    const updated = seasons.filter((s) => s.id !== seasonId);
    setSeasons(updated);
    if (currentSeason && currentSeason.id === seasonId) {
      setCurrentSeason(updated[0] || null);
    }
    save(updated);
  };

  const deleteAllSeasons = () => {
    localStorage.removeItem("cwl-seasons");
    setSeasons([]);
    setCurrentSeason(null);
  };

  const updateSeasonData = (updatedSeason) => {
    const updatedSeasons = seasons.map((s) =>
      s.id === updatedSeason.id ? updatedSeason : s
    );
    setCurrentSeason(updatedSeason);
    setSeasons(updatedSeasons);
    save(updatedSeasons);
  };

  return {
    seasons,
    currentSeason,
    setCurrentSeason,
    addSeason,
    deleteSeason,
    deleteAllSeasons,
    updateSeasonData,
    saveStatus,
    loading,
    getSeasonsByYear, // Nueva función
  };
};