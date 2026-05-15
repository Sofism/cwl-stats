import React, { useState } from "react";
import { Trophy, Calendar, Plus, ChevronDown, ChevronRight, Play, Share2, Settings, GripVertical } from "lucide-react";
import NewSeasonModal from "./NewSeasonModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import SettingsModal from "./SettingsModal";
import { createShareLink } from "../utils/shareUtils";

const SeasonSelector = ({ 
  seasons, 
  onSelectSeason, 
  onNewSeason, 
  onDeleteSeason,
  onReorderSeasons,
  getSeasonsByYear,
  isSharedMode,
  clanNames,
  onUpdateClanNames
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedYears, setExpandedYears] = useState({});
  const [shareStatus, setShareStatus] = useState("");
  const [draggedItem, setDraggedItem] = useState(null);

  const seasonsByYear = getSeasonsByYear();
  const years = Object.keys(seasonsByYear).sort((a, b) => b - a);

  // Expand most recent year by default
  if (years.length > 0 && Object.keys(expandedYears).length === 0) {
    expandedYears[years[0]] = true;
  }

  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  const handleDeleteConfirm = () => {
    onDeleteSeason(deleteConfirm);
    setDeleteConfirm(null);
  };

  const handleShareAll = async () => {
    if (seasons.length === 0) return;
    
    try {
      setShareStatus('⏳ Generating link...');
      const shareUrl = await createShareLink(seasons, seasons[0].id);
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'CWL Stats - All Seasons',
            text: `All my CWL seasons (${seasons.length} seasons)`,
            url: shareUrl
          });
          setShareStatus('✓ Shared successfully!');
          setTimeout(() => setShareStatus(''), 3000);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('✓ Link copied! Your friends will see all seasons.');
      setTimeout(() => setShareStatus(''), 5000);
    } catch (error) {
      console.error('Share error:', error);
      setShareStatus('✗ Error sharing');
      setTimeout(() => setShareStatus(''), 3000);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, year, seasonId) => {
    setDraggedItem({ year, seasonId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetYear, targetSeasonId) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.seasonId === targetSeasonId) {
      setDraggedItem(null);
      return;
    }

    // Get all seasons from the same year
    const yearSeasons = seasonsByYear[targetYear];
    const draggedIndex = yearSeasons.findIndex(s => s.id === draggedItem.seasonId);
    const targetIndex = yearSeasons.findIndex(s => s.id === targetSeasonId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // Reorder within the year
    const reordered = [...yearSeasons];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Rebuild the full seasons array with new order
    const otherYears = years.filter(y => y !== targetYear);
    const newSeasons = [
      ...reordered,
      ...otherYears.flatMap(y => seasonsByYear[y])
    ];

    onReorderSeasons(newSeasons);
    setDraggedItem(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with Settings Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            CWL Stats Tracker
          </h1>
          <p className="text-gray-400 text-lg">
            {isSharedMode 
              ? "Viewing shared seasons (read-only)" 
              : "Select or create a season to get started"}
          </p>
        </div>

        {/* Shared Mode Banner */}
        {isSharedMode && (
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500 rounded-lg text-center">
            <p className="text-blue-300 font-semibold">
              👀 You're viewing shared data. Changes won't be saved.
            </p>
          </div>
        )}

        {/* Create New Season and Share All Buttons */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-lg"
          >
            <Plus className="w-6 h-6" />
            <span className="text-lg">Create New Season</span>
          </button>
          
          {seasons.length > 0 && (
            <button
              onClick={handleShareAll}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-lg"
            >
              <Share2 className="w-6 h-6" />
              <span className="text-lg">Share All</span>
            </button>
          )}
        </div>

        {/* Share Status Message */}
        {shareStatus && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500 text-green-300">
            {shareStatus}
          </div>
        )}

        {/* Seasons List */}
        {seasons.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-400 mb-2">No Seasons Yet</h2>
            <p className="text-gray-500">Create your first season to start tracking CWL stats</p>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-400" />
                Your Seasons
              </h2>
              <span className="text-sm text-gray-400">
                {seasons.length} season{seasons.length !== 1 ? 's' : ''} total
              </span>
            </div>

            {!isSharedMode && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  💡 Tip: Drag seasons with <GripVertical className="w-4 h-4 inline" /> to reorder them
                </p>
              </div>
            )}

            <div className="space-y-3">
              {years.map(year => {
                const isExpanded = expandedYears[year] !== false;
                const yearSeasons = seasonsByYear[year];
                
                return (
                  <div key={year} className="border border-gray-700 rounded-lg overflow-hidden">
                    {/* Year Header */}
                    <button
                      onClick={() => toggleYear(year)}
                      className="w-full flex items-center justify-between bg-gray-900 p-4 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-purple-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-purple-400" />
                        )}
                        <span className="font-bold text-xl text-purple-400">{year}</span>
                        <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
                          {yearSeasons.length} season{yearSeasons.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                    
                    {/* Seasons in this year */}
                    {isExpanded && (
                      <div className="bg-gray-900/50 divide-y divide-gray-700">
                        {yearSeasons.map(season => {
                          const totalPlayers = season.mainClan.length + season.secondaryClan.length;
                          const hasData = totalPlayers > 0;
                          const isDragging = draggedItem?.seasonId === season.id;
                          
                          return (
                            <div
                              key={season.id}
                              draggable={!isSharedMode}
                              onDragStart={(e) => handleDragStart(e, year, season.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, year, season.id)}
                              className={`flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors ${
                                isDragging ? 'opacity-50' : ''
                              } ${!isSharedMode ? 'cursor-move' : ''}`}
                            >
                              {!isSharedMode && (
                                <div className="mr-2 text-gray-500 hover:text-gray-300">
                                  <GripVertical className="w-5 h-5" />
                                </div>
                              )}
                              
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg text-white mb-1">
                                  {season.name}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span>
                                    {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
                                  </span>
                                  {hasData && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        {clanNames.main}: {season.mainClan.length} | {clanNames.secondary}: {season.secondaryClan.length}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onSelectSeason(season)}
                                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                  <Play className="w-4 h-4" />
                                  Open
                                </button>
                                {!isSharedMode && (
                                  <button
                                    onClick={() => setDeleteConfirm(season.id)}
                                    className="bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-400 font-semibold px-4 py-2 rounded-lg transition-colors"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modals */}
        {showModal && (
          <NewSeasonModal
            onCreateSeason={(name, year) => {
              onNewSeason(name, year);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        )}

        {showSettings && (
          <SettingsModal
            clanNames={clanNames}
            onSave={onUpdateClanNames}
            onClose={() => setShowSettings(false)}
          />
        )}

        {deleteConfirm && (
          <DeleteConfirmModal
            isAll={false}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SeasonSelector;
