import React, { useState, useEffect } from "react";
import {
  Trophy,
  Users,
  Target,
  Shield,
  Award,
  AlertCircle,
  Share2,
  Trash2,
  Loader,
  Calendar,
  Plus,
} from "lucide-react";

const CWLStatsTracker = () => {
  const [seasons, setSeasons] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [activePage, setActivePage] = useState("main");
  const [showImport, setShowImport] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("default");
  const [showModal, setShowModal] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState({
    main: { league: "Crystal I", position: 1 },
    secondary: { league: "Crystal I", position: 1 },
  });
  const [visibleCols, setVisibleCols] = useState({
    th: true,
    missAtk: true,
    missDef: false,
    netStars: true,
    netPercent: false,
    threeRate: true,
    starGain: false,
    percentGain: false,
    starGive: false,
    percentGive: false,
  });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showColSelector, setShowColSelector] = useState(false);

  const leagues = [
    "Champion I",
    "Champion II",
    "Champion III",
    "Master I",
    "Master II",
    "Master III",
    "Crystal I",
    "Crystal II",
    "Crystal III",
  ];

  const bonuses = {
    "Champion I": [10, 9, 8, 7, 6, 5, 4, 3],
    "Champion II": [10, 9, 8, 7, 6, 5, 4, 3],
    "Champion III": [10, 9, 8, 7, 6, 5, 4, 3],
    "Master I": [10, 9, 8, 7, 6, 5, 4, 3],
    "Master II": [10, 9, 8, 7, 6, 5, 4, 3],
    "Master III": [10, 9, 8, 7, 6, 5, 4, 3],
    "Crystal I": [9, 8, 7, 6, 5, 4, 3, 2],
    "Crystal II": [9, 8, 7, 6, 5, 4, 3, 2],
    "Crystal III": [9, 8, 7, 6, 5, 4, 3, 2],
  };

  useEffect(() => {
  setLoading(true);

  const params = new URLSearchParams(window.location.search);
  
  // Verificar si es un enlace compartido nuevo (con ID corto)
  const shareId = params.get("share");
  
  if (shareId) {
    // Cargar datos desde la API
    fetch(`/api/get-share?id=${shareId}`)
      .then(res => {
        if (!res.ok) throw new Error('Share not found');
        return res.json();
      })
      .then(data => {
        if (data.season) {
          setCurrentSeason(data.season);
          if (data.season.leagueInfo) {
            setLeagueInfo(data.season.leagueInfo);
          }
          setShowImport(false);
          setLoading(false);
          // Limpiar URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(err => {
        console.error('Error loading shared data:', err);
        setLoading(false);
      });
    return;
  }
  
  // Soporte para enlaces viejos con ?data= (por compatibilidad)
  const sharedData = params.get("data");
  if (sharedData) {
    try {
      const decoded = JSON.parse(
        decodeURIComponent(escape(atob(sharedData)))
      );
      if (decoded.season) {
        setCurrentSeason(decoded.season);
        if (decoded.season.leagueInfo) {
          setLeagueInfo(decoded.season.leagueInfo);
        }
        setShowImport(false);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Error loading shared data:", err);
    }
  }

  // Resto del código original (cargar desde localStorage)
  try {
    const saved = localStorage.getItem("cwl-seasons");
    // ... tu código existente
      console.log("Decoded data:", decoded); // DEBUG
      
      if (decoded.season) {
        console.log("Setting season:", decoded.season); // DEBUG
        setCurrentSeason(decoded.season);
        if (decoded.season.leagueInfo) {
          setLeagueInfo(decoded.season.leagueInfo);
        }
        setShowImport(false);
        setLoading(false);
        window.history.replaceState({}, '', window.location.pathname); // Limpia URL
        return;
      }
    } catch (err) {
      console.error("Error loading shared data:", err); // Cambiado a console.error
    }
  }

    try {
      const saved = localStorage.getItem("cwl-seasons");
      if (saved) {
        const parsedSeasons = JSON.parse(saved);
        setSeasons(parsedSeasons);
        if (parsedSeasons.length > 0) {
          const lastSeason = parsedSeasons[0];
          setCurrentSeason(lastSeason);
          if (lastSeason.leagueInfo) {
            setLeagueInfo(lastSeason.leagueInfo);
          }
          const hasData =
            (lastSeason.mainClan && lastSeason.mainClan.length > 0) ||
            (lastSeason.secondaryClan && lastSeason.secondaryClan.length > 0);
          setShowImport(!hasData);
        }
      }
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  }, []);

  const save = (updated) => {
    try {
      localStorage.setItem("cwl-seasons", JSON.stringify(updated));
      setSaveStatus("✓ Saved");
      setTimeout(() => setSaveStatus(""), 2000);
      return true;
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("✗ Failed");
      return false;
    }
  };

  const parseData = (text, clan) => {
    const lines = text.trim().split("\n");
    const data = [];

    for (let i = 0; i < lines.length; i++) {
      const c = lines[i].split(/\t/).map((x) => x.trim());
      if (c[0] === "Name" || !c[0] || c.length < 26) continue;

      const wars = parseInt(c[3]) || 0;
      const offStars = parseInt(c[6]) || 0;
      const offDest = parseFloat(c[10]) || 0;
      const threeStarCount = parseInt(c[12]) || 0;
      const twoStarCount = parseInt(c[13]) || 0;
      const oneStarCount = parseInt(c[14]) || 0;
      const zeroStarCount = parseInt(c[15]) || 0;
      const missAtk = parseInt(c[16]) || 0;
      const totalDef = parseInt(c[17]) || 0;
      const missDef = Math.max(0, wars - totalDef);
      const defStarsRaw = parseInt(c[18]) || 0;
      const defDestRaw = parseFloat(c[20]) || 0;
      const defStars = defStarsRaw + missDef * 2;
      const defDest = defDestRaw + missDef * 85;
      const avgDistance = parseFloat(c[25]) || 0;

      data.push({
        name: c[0],
        clan: clan,
        th: parseInt(c[2]) || 0,
        missAtk: missAtk,
        offStars: offStars,
        offDest: offDest,
        defStars: defStars,
        defDest: defDest,
        netStars: offStars - defStars,
        netDest: offDest - defDest,
        threeRate: wars > 0 ? (threeStarCount / wars) * 100 : 0,
        wars: wars,
        missDef: missDef,
        stars3: threeStarCount,
        stars2: twoStarCount,
        stars1: oneStarCount,
        stars0: zeroStarCount,
        avgDistance: avgDistance,
      });
    }

    return data.sort((a, b) => {
      if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
      if (b.netStars !== a.netStars) return b.netStars - a.netStars;
      if (a.avgDistance !== b.avgDistance) return a.avgDistance - b.avgDistance;
      if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
      return b.netDest - a.netDest;
    });
  };
  const handleImport = (text, isMain) => {
    if (!text.trim() || !currentSeason) return;
    const key = isMain ? "mainClan" : "secondaryClan";
    const parsedData = parseData(text, isMain ? "Main" : "Secondary");
    const updated = {
      ...currentSeason,
      [key]: parsedData,
      leagueInfo: leagueInfo,
    };
    const updatedSeasons = seasons.map((s) =>
      s.id === currentSeason.id ? updated : s
    );
    setCurrentSeason(updated);
    setSeasons(updatedSeasons);
    save(updatedSeasons);
  };

  const updateLeague = (newInfo) => {
    setLeagueInfo(newInfo);
    if (!currentSeason) return;
    const updated = { ...currentSeason, leagueInfo: newInfo };
    const updatedSeasons = seasons.map((s) =>
      s.id === currentSeason.id ? updated : s
    );
    setCurrentSeason(updated);
    setSeasons(updatedSeasons);
    save(updatedSeasons);
  };

  const getData = () => {
    if (!currentSeason) return [];
    const sourceData =
      activePage === "main"
        ? currentSeason.mainClan
        : currentSeason.secondaryClan;
    let data = [...sourceData];

    if (sortBy === "netStars") {
      data.sort((a, b) => b.netStars - a.netStars);
    } else if (sortBy === "netPercent") {
      data.sort((a, b) => b.netDest - a.netDest);
    } else if (sortBy === "threeRate") {
      data.sort((a, b) => b.threeRate - a.threeRate);
    } else if (sortBy === "missAtk") {
      data.sort((a, b) => a.missAtk - b.missAtk);
    } else {
      data.sort((a, b) => {
        if (a.missAtk !== b.missAtk) return a.missAtk - b.missAtk;
        if (b.netStars !== a.netStars) return b.netStars - a.netStars;
        if (a.avgDistance !== b.avgDistance)
          return a.avgDistance - b.avgDistance;
        if (b.threeRate !== a.threeRate) return b.threeRate - a.threeRate;
        return b.netDest - a.netDest;
      });
    }

    const info = activePage === "main" ? leagueInfo.main : leagueInfo.secondary;
    const pos = parseInt(info.position);
    const bonusCount =
      pos >= 1 && pos <= 8
        ? (bonuses[info.league] && bonuses[info.league][pos - 1]) || 0
        : 0;

    return data.map((p, i) => ({
      ...p,
      getsBonus: i < bonusCount,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader className="animate-spin w-16 h-16 text-purple-500" />
      </div>
    );
  }

  if (showImport || !currentSeason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              CWL Stats Tracker
            </h1>
          </div>

          {saveStatus && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500 text-green-300">
              {saveStatus}
            </div>
          )}

          {seasons.length > 0 && (
            <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Seasons
                </h3>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-sm bg-purple-500 px-3 py-1 rounded hover:bg-purple-600"
                >
                  + New
                </button>
              </div>
              <div className="space-y-2">
                {seasons.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-gray-900 p-3 rounded"
                  >
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.mainClan.length + s.secondaryClan.length} players
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentSeason(s);
                          if (s.leagueInfo) setLeagueInfo(s.leagueInfo);
                          const hasData =
                            (s.mainClan && s.mainClan.length > 0) ||
                            (s.secondaryClan && s.secondaryClan.length > 0);
                          setShowImport(!hasData);
                        }}
                        className="text-sm bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(s.id)}
                        className="text-sm bg-red-500/20 border border-red-500 px-3 py-1 rounded hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!currentSeason ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
              <Calendar className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">No Season Selected</h2>
              <button
                onClick={() => setShowModal(true)}
                className="bg-purple-500 text-white font-bold py-3 px-6 rounded-lg inline-flex items-center gap-2 hover:bg-purple-600"
              >
                <Plus className="w-5 h-5" />
                Create New Season
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  League Settings
                </h3>
                <div className="space-y-4">
                  {["main", "secondary"].map((clan) => (
                    <div key={clan} className="bg-gray-900 p-4 rounded-lg">
                      <h4
                        className={
                          clan === "main"
                            ? "font-semibold mb-3 text-purple-400"
                            : "font-semibold mb-3 text-blue-400"
                        }
                      >
                        {clan === "main" ? "True North" : "DD"}
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            League
                          </label>
                          <select
                            value={leagueInfo[clan].league}
                            onChange={(e) => {
                              const newLeagueInfo = {
                                ...leagueInfo,
                                [clan]: {
                                  ...leagueInfo[clan],
                                  league: e.target.value,
                                },
                              };
                              updateLeague(newLeagueInfo);
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          >
                            {leagues.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            Position (1-8)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="8"
                            value={leagueInfo[clan].position}
                            onChange={(e) => {
                              const newLeagueInfo = {
                                ...leagueInfo,
                                [clan]: {
                                  ...leagueInfo[clan],
                                  position: parseInt(e.target.value) || 1,
                                },
                              };
                              updateLeague(newLeagueInfo);
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-purple-400" />
                    True North
                  </h2>
                  <textarea
                    className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono text-white"
                    placeholder="Paste spreadsheet data here..."
                    onChange={(e) => handleImport(e.target.value, true)}
                  />
                  {currentSeason.mainClan.length > 0 && (
                    <div className="mt-3 text-green-400 text-sm">
                      ✓ {currentSeason.mainClan.length} players loaded
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-400" />
                    DD
                  </h2>
                  <textarea
                    className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono text-white"
                    placeholder="Paste spreadsheet data here..."
                    onChange={(e) => handleImport(e.target.value, false)}
                  />
                  {currentSeason.secondaryClan.length > 0 && (
                    <div className="mt-3 text-green-400 text-sm">
                      ✓ {currentSeason.secondaryClan.length} players loaded
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <AlertCircle className="w-5 h-5 text-blue-400 inline mr-2" />
                <span className="text-sm text-blue-200">
                  Copy data from Excel/Google Sheets and paste here. Data saves
                  automatically!
                </span>
              </div>

              {(currentSeason.mainClan.length > 0 ||
                currentSeason.secondaryClan.length > 0) && (
                <button
                  onClick={() => setShowImport(false)}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 rounded-lg transition-colors"
                >
                  View Dashboard →
                </button>
              )}
            </>
          )}

          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-800 border border-red-500 rounded-lg p-6 max-w-md w-full">
                <h3 className="text-xl font-bold mb-4 text-red-400">
                  Confirm Delete
                </h3>
                <p className="mb-6 text-gray-300">
                  {deleteConfirm === "ALL"
                    ? "Delete ALL seasons? This cannot be undone!"
                    : "Delete this season?"}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteConfirm(null);
                      if (deleteConfirm === "ALL") {
                        localStorage.removeItem("cwl-seasons");
                        setSeasons([]);
                        setCurrentSeason(null);
                        setShowImport(true);
                      } else {
                        const updated = seasons.filter(
                          (s) => s.id !== deleteConfirm
                        );
                        setSeasons(updated);
                        if (
                          currentSeason &&
                          currentSeason.id === deleteConfirm
                        ) {
                          setCurrentSeason(updated[0] || null);
                          if (updated.length === 0) setShowImport(true);
                        }
                        save(updated);
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
                <h3 className="text-xl font-bold mb-4">New Season</h3>
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g., December 2024"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-3 mb-4 text-white"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (!newSeasonName.trim()) return;
                      const newSeason = {
                        id: Date.now().toString(),
                        name: newSeasonName.trim(),
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
                      setLeagueInfo(newSeason.leagueInfo);
                      save(updated);
                      setShowModal(false);
                      setNewSeasonName("");
                      setShowImport(true);
                    }}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setNewSeasonName("");
                    }}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const data = getData();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              CWL Performance
            </h1>
            <select
              value={currentSeason.id}
              onChange={(e) => {
                const s = seasons.find((x) => x.id === e.target.value);
                setCurrentSeason(s);
                if (s && s.leagueInfo) setLeagueInfo(s.leagueInfo);
              }}
              className="mt-2 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
           <button 
  onClick={async () => { 
    if (!currentSeason) return;
    
    try {
      setSaveStatus('⏳ Generando enlace...');
      
      // Llamar a la API para guardar los datos
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: currentSeason })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create share link');
      }
      
      const { shareId } = await response.json();
      const shareUrl = `${window.location.origin}?share=${shareId}`;
      
      // Intentar Web Share API
      if (navigator.share) {
        try {
          await navigator.share({
            title: `CWL Stats - ${currentSeason.name}`,
            text: `Mis estadísticas de CWL para ${currentSeason.name}`,
            url: shareUrl
          });
          setSaveStatus('✓ Compartido exitosamente!');
          setTimeout(() => setSaveStatus(''), 3000);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      
      // Copiar al portapapeles
      await navigator.clipboard.writeText(shareUrl);
      setSaveStatus('✓ Link copiado al portapapeles!');
      setTimeout(() => setSaveStatus(''), 5000);
      
    } catch (error) {
      console.error('Share error:', error);
      setSaveStatus('✗ Error al compartir');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }} 
  className="px-4 py-2 bg-green-600 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
>
  <Share2 className="w-4 h-4" />
  Share
</button>
                
                // Intentar Web Share API (móviles principalmente)
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `CWL Stats - ${currentSeason.name}`,
                      text: `Mis estadísticas de CWL para ${currentSeason.name}`,
                      url: shareUrl
                    });
                    setSaveStatus('✓ Compartido exitosamente!');
                    setTimeout(() => setSaveStatus(''), 3000);
                    return;
                  } catch (err) {
                    // Si el usuario cancela, no hacer nada
                    if (err.name === 'AbortError') return;
                    // Si Web Share falla, intentar copiar al portapapeles
                  }
                }
                
                // Fallback: copiar al portapapeles
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setSaveStatus('✓ Link copiado al portapapeles!');
                  setTimeout(() => setSaveStatus(''), 3000);
                } catch (clipErr) {
                  console.error('Error:', clipErr);
                  setSaveStatus('✗ No se pudo compartir');
                  setTimeout(() => setSaveStatus(''), 3000);
                }
              }} 
              className="px-4 py-2 bg-green-600 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Update
            </button>
            <button
              onClick={() => setDeleteConfirm("ALL")}
              className="px-4 py-2 bg-red-600/20 border border-red-600 rounded-lg hover:bg-red-600/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500 text-green-300">
            {saveStatus}
          </div>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full mb-4 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
        >
          <option value="default">Default Sort</option>
          <option value="netStars">Net Stars</option>
          <option value="netPercent">Net %</option>
          <option value="threeRate">3★ Hitrate</option>
          <option value="missAtk">Missed Attacks</option>
        </select>

        <div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <button
            onClick={() => setShowColSelector(!showColSelector)}
            className="flex items-center justify-between w-full text-sm font-semibold"
          >
            <span>Column Visibility</span>
            <span className="text-gray-400">{showColSelector ? "▼" : "▶"}</span>
          </button>
          {showColSelector && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { key: "th", label: "TH" },
                  { key: "missAtk", label: "Miss Atk" },
                  { key: "missDef", label: "Miss Def" },
                  { key: "netStars", label: "Net ★" },
                  { key: "netPercent", label: "Net %" },
                  { key: "threeRate", label: "3★%" },
                  { key: "starGain", label: "★ Gain" },
                  { key: "percentGain", label: "% Gain" },
                  { key: "starGive", label: "★ Give" },
                  { key: "percentGive", label: "% Give" },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-700/30 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[key]}
                      onChange={(e) =>
                        setVisibleCols({
                          ...visibleCols,
                          [key]: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {["main", "secondary"].map((page) => {
            const isActive = activePage === page;
            const isPurple = page === "main";
            return (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                  isActive
                    ? isPurple
                      ? "bg-purple-500/30 border-2 border-purple-500"
                      : "bg-blue-500/30 border-2 border-blue-500"
                    : "bg-gray-800 border-2 border-gray-700"
                }`}
              >
                <div>
                  {page === "main" ? "True North" : "DD"} (
                  {
                    currentSeason[
                      page === "main" ? "mainClan" : "secondaryClan"
                    ].length
                  }
                  )
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {leagueInfo[page].league} - Pos {leagueInfo[page].position}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              icon: Target,
              value: data.length,
              label: "Total Players",
              colorClass: "text-green-400",
            },
            {
              icon: Shield,
              value: data.filter((p) => p.missAtk > 0).length,
              label: "Missed Attacks",
              colorClass: "text-red-400",
            },
            {
              icon: Trophy,
              value: `${
                data.length > 0
                  ? (
                      data.reduce((s, p) => s + p.threeRate, 0) / data.length
                    ).toFixed(1)
                  : 0
              }%`,
              label: "Avg 3★ Rate",
              colorClass: "text-purple-400",
            },
            {
              icon: Award,
              value: (() => {
                const info =
                  activePage === "main"
                    ? leagueInfo.main
                    : leagueInfo.secondary;
                const pos = parseInt(info.position);
                return pos >= 1 && pos <= 8
                  ? bonuses[info.league]?.[pos - 1] || 0
                  : 0;
              })(),
              label: "Bonus Recipients",
              colorClass: "text-yellow-400",
            },
          ].map(({ icon: Icon, value, label, colorClass }, i) => (
            <div
              key={i}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center"
            >
              <Icon className={`w-8 h-8 ${colorClass} mx-auto mb-3`} />
              <p className={`text-3xl font-bold mb-1 ${colorClass}`}>{value}</p>
              <p className="text-sm text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-1">Missed Defences Correction:</p>
              <p>
                When a player misses a defence, the system adds{" "}
                <span className="font-bold">+2 stars</span> and{" "}
                <span className="font-bold">+85%</span> to defensive stats for
                fair ranking.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div
            className="overflow-x-auto"
            style={{ maxHeight: "600px", overflowY: "auto" }}
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-900 sticky top-0 z-10">
                <tr className="text-left text-xs text-gray-400">
                  <th className="p-3">Rank</th>
                  <th className="p-3">Player</th>
                  {visibleCols.th && <th className="p-3">TH</th>}
                  {visibleCols.missAtk && <th className="p-3">Miss Atk</th>}
                  {activePage === "secondary" && visibleCols.missDef && (
                    <th className="p-3">Miss Def</th>
                  )}
                  {visibleCols.netStars && <th className="p-3">Net ★</th>}
                  {visibleCols.netPercent && <th className="p-3">Net %</th>}
                  {visibleCols.threeRate && <th className="p-3">3★%</th>}
                  {visibleCols.starGain && <th className="p-3">★ Gain</th>}
                  {visibleCols.percentGain && <th className="p-3">% Gain</th>}
                  {visibleCols.starGive && <th className="p-3">★ Give</th>}
                  {visibleCols.percentGive && <th className="p-3">% Give</th>}
                  <th className="p-3">Stats</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="p-8 text-center text-gray-400">
                      No data
                    </td>
                  </tr>
                ) : (
                  data.map((p, i) => (
                    <tr
                      key={i}
                      className={`border-t border-gray-700 hover:bg-gray-700/30 ${
                        p.getsBonus ? "bg-yellow-500/10" : ""
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              i < 3 ? "text-yellow-400" : "text-gray-400"
                            }`}
                          >
                            #{i + 1}
                          </span>
                          {p.getsBonus && (
                            <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">
                              BONUS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-semibold">{p.name}</td>
                      {visibleCols.th && <td className="p-3">{p.th}</td>}
                      {visibleCols.missAtk && (
                        <td className="p-3">
                          {p.missAtk > 0 ? (
                            <span className="text-red-400 font-bold">
                              {p.missAtk}
                            </span>
                          ) : (
                            <span className="text-green-400">✓</span>
                          )}
                        </td>
                      )}
                      {activePage === "secondary" && visibleCols.missDef && (
                        <td className="p-3">
                          {p.missDef > 0 ? (
                            <span className="text-orange-400 font-bold">
                              {p.missDef}
                            </span>
                          ) : (
                            <span className="text-green-400">✓</span>
                          )}
                        </td>
                      )}
                      {visibleCols.netStars && (
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <span
                              className={`font-bold ${
                                p.netStars >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {p.netStars >= 0 ? "+" : ""}
                              {p.netStars}
                            </span>
                            {p.avgDistance !== 0 && (
                              <span
                                className={`text-xs ${
                                  p.avgDistance < 0
                                    ? "text-cyan-400"
                                    : "text-orange-400"
                                }`}
                                title={`Avg Distance: ${p.avgDistance.toFixed(
                                  1
                                )}`}
                              >
                                ({p.avgDistance > 0 ? "+" : ""}
                                {p.avgDistance.toFixed(1)})
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleCols.netPercent && (
                        <td className="p-3">
                          <span
                            className={`font-bold ${
                              p.netDest >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {p.netDest >= 0 ? "+" : ""}
                            {p.netDest.toFixed(1)}%
                          </span>
                        </td>
                      )}
                      {visibleCols.threeRate && (
                        <td className="p-3 text-purple-400 font-semibold">
                          {p.threeRate.toFixed(1)}%
                        </td>
                      )}
                      {visibleCols.starGain && (
                        <td className="p-3 text-green-400">{p.offStars}</td>
                      )}
                      {visibleCols.percentGain && (
                        <td className="p-3 text-green-400">
                          {p.offDest.toFixed(1)}%
                        </td>
                      )}
                      {visibleCols.starGive && (
                        <td className="p-3 text-red-400">{p.defStars}</td>
                      )}
                      {visibleCols.percentGive && (
                        <td className="p-3 text-red-400">
                          {p.defDest.toFixed(1)}%
                        </td>
                      )}
                      <td className="p-3">
                        <button
                          onClick={() => setSelectedPlayer(p)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {selectedPlayer && (
          <div
            className="fixed inset-0 bg-black/70 z-50 overflow-y-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="min-h-screen px-4 py-8 flex items-center justify-center">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-4xl w-full my-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {selectedPlayer.name}
                    </h2>
                    <p className="text-gray-400">
                      TH{selectedPlayer.th} • {selectedPlayer.clan}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-gray-400 hover:text-white text-3xl leading-none -mt-2"
                  >
                    &times;
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-900 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-green-400">
                      {selectedPlayer.offStars}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">Stars Gained</p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-red-400">
                      {selectedPlayer.defStars}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">Stars Given</p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg text-center">
                    <p
                      className={`text-3xl font-bold ${
                        selectedPlayer.netStars >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {selectedPlayer.netStars >= 0 ? "+" : ""}
                      {selectedPlayer.netStars}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">Net Stars</p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-purple-400">
                      {selectedPlayer.threeRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-400 mt-1">3-Star Rate</p>
                  </div>
                </div>

                <div className="bg-gray-900 p-4 rounded-lg mb-6">
                  <h3 className="font-semibold text-yellow-400 mb-4">
                    Attack Distribution
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        stars: 3,
                        count: selectedPlayer.stars3,
                        color: "bg-yellow-400",
                        label: "3 Stars",
                      },
                      {
                        stars: 2,
                        count: selectedPlayer.stars2,
                        color: "bg-orange-400",
                        label: "2 Stars",
                      },
                      {
                        stars: 1,
                        count: selectedPlayer.stars1,
                        color: "bg-red-400",
                        label: "1 Star",
                      },
                      {
                        stars: 0,
                        count: selectedPlayer.stars0,
                        color: "bg-gray-600",
                        label: "0 Stars",
                      },
                    ].map(({ stars, count, color, label }) => {
                      const total =
                        selectedPlayer.wars - selectedPlayer.missAtk;
                      const percentage = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={stars}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300">{label}</span>
                            <span className="text-white font-semibold">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${color}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-400 mb-3">
                      Offensive Stats
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Stars:</span>
                        <span className="text-white font-semibold">
                          {selectedPlayer.offStars}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          Total Destruction:
                        </span>
                        <span className="text-white font-semibold">
                          {selectedPlayer.offDest.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          Wars Participated:
                        </span>
                        <span className="text-white font-semibold">
                          {selectedPlayer.wars}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Missed Attacks:</span>
                        <span
                          className={
                            selectedPlayer.missAtk > 0
                              ? "text-red-400 font-bold"
                              : "text-green-400 font-semibold"
                          }
                        >
                          {selectedPlayer.missAtk > 0
                            ? selectedPlayer.missAtk
                            : "0 ✓"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 p-4 rounded-lg">
                    <h3 className="font-semibold text-red-400 mb-3">
                      Defensive Stats
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Stars Conceded:</span>
                        <span className="text-white font-semibold">
                          {selectedPlayer.defStars}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          Destruction Taken:
                        </span>
                        <span className="text-white font-semibold">
                          {selectedPlayer.defDest.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Defenses:</span>
                        <span className="text-white font-semibold">
                          {selectedPlayer.wars - selectedPlayer.missDef}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Missed Defenses:</span>
                        <span
                          className={
                            selectedPlayer.missDef > 0
                              ? "text-orange-400 font-bold"
                              : "text-green-400 font-semibold"
                          }
                        >
                          {selectedPlayer.missDef > 0
                            ? selectedPlayer.missDef
                            : "0 ✓"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 p-4 rounded-lg mb-6">
                  <h3 className="font-semibold text-blue-400 mb-3">
                    Performance Metrics
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Net Stars</span>
                        <span
                          className={
                            selectedPlayer.netStars >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {selectedPlayer.netStars >= 0 ? "+" : ""}
                          {selectedPlayer.netStars}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            selectedPlayer.netStars >= 0
                              ? "bg-green-400"
                              : "bg-red-400"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.abs(selectedPlayer.netStars) * 10
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Net Destruction</span>
                        <span
                          className={
                            selectedPlayer.netDest >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {selectedPlayer.netDest >= 0 ? "+" : ""}
                          {selectedPlayer.netDest.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            selectedPlayer.netDest >= 0
                              ? "bg-green-400"
                              : "bg-red-400"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.abs(selectedPlayer.netDest)
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">3-Star Rate</span>
                        <span className="text-purple-400">
                          {selectedPlayer.threeRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-purple-400"
                          style={{ width: `${selectedPlayer.threeRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CWLStatsTracker;
