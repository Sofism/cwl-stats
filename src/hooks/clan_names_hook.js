import { useState, useEffect } from "react";

export const useClanNames = () => {
  const [clanNames, setClanNames] = useState({
    main: "Main Clan",
    secondary: "Secondary Clan"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cwl-clan-names");
      if (saved) {
        const parsed = JSON.parse(saved);
        setClanNames(parsed);
      }
    } catch (err) {
      console.error("Error loading clan names:", err);
    }
    setLoading(false);
  }, []);

  const updateClanNames = (newNames) => {
    try {
      localStorage.setItem("cwl-clan-names", JSON.stringify(newNames));
      setClanNames(newNames);
      return true;
    } catch (err) {
      console.error("Error saving clan names:", err);
      return false;
    }
  };

  return {
    clanNames,
    updateClanNames,
    loading
  };
};