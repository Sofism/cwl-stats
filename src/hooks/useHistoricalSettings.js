import { useState, useEffect } from "react";

const STORAGE_KEY = "cwl-historical-settings";

const defaultSettings = {
  aliases: {},
  activeMembers: [],
};

export const useHistoricalSettings = () => {
  const [settings, setSettings] = useState(defaultSettings);

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

  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("Error saving historical settings:", err);
    }
  };

  const addAlias = (from, to) => {
    updateSettings({ aliases: { ...settings.aliases, [from]: to } });
  };

  const removeAlias = (from) => {
    const updated = { ...settings.aliases };
    delete updated[from];
    updateSettings({ aliases: updated });
  };

  const setActiveMembers = (members) => updateSettings({ activeMembers: members });

  const resetAll = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    aliases: settings.aliases,
    activeMembers: settings.activeMembers,
    addAlias,
    removeAlias,
    setActiveMembers,
    resetAll,
  };
};
