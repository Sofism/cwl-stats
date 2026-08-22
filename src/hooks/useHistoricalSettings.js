import { useState, useEffect } from "react";

const STORAGE_KEY = "cwl-historical-settings";

const defaultSettings = {
  aliases: {},
  inactivePlayers: [],
  activeMembers: { main: [], secondary: [] },
};

export const useHistoricalSettings = () => {
  const [settings, setSettings] = useState(defaultSettings);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (err) {
      console.error("Error loading historical settings:", err);
    }
  }, []);

  // Save to localStorage whenever settings change
  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("Error saving historical settings:", err);
    }
  };

  const setAliases = (aliases) => updateSettings({ aliases });
  
  const addAlias = (from, to) => {
    updateSettings({ aliases: { ...settings.aliases, [from]: to } });
  };
  
  const removeAlias = (from) => {
    const updated = { ...settings.aliases };
    delete updated[from];
    updateSettings({ aliases: updated });
  };

  const setInactivePlayers = (inactivePlayers) => updateSettings({ inactivePlayers });
  
  const toggleInactive = (name) => {
    const current = settings.inactivePlayers;
    const updated = current.includes(name)
      ? current.filter(p => p !== name)
      : [...current, name];
    updateSettings({ inactivePlayers: updated });
  };

  const setActiveMembers = (clan, members) => {
    updateSettings({
      activeMembers: { ...settings.activeMembers, [clan]: members }
    });
  };

  const resetAll = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    aliases: settings.aliases,
    inactivePlayers: settings.inactivePlayers,
    activeMembers: settings.activeMembers,
    addAlias,
    removeAlias,
    toggleInactive,
    setInactivePlayers,
    setActiveMembers,
    resetAll,
  };
};
