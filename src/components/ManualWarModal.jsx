import React, { useState } from "react";
import { X } from "lucide-react";
import { parseData } from "../utils/dataParser";

/**
 * Guerra normal pegada a mano, para cuando el cron (api/sync.js) no la
 * capturo a tiempo. Reutiliza EL MISMO parser tabulado que ya se usa para
 * las 11 temporadas historicas de CWL (dataParser.js): mismas columnas,
 * mismo origen de datos (el bot/Excel de Santi), solo que aqui es una
 * guerra suelta en vez de una temporada entera.
 */
const ManualWarModal = ({ clanNames, onClose }) => {
  const [clan, setClan] = useState("main");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [opponentName, setOpponentName] = useState("");
  const [result, setResult] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const clanTag = clan === "main" ? clanNames?.mainTag : clanNames?.secondaryTag;
  const clanLabel = clan === "main" ? "Main" : "Secondary";

  const handleSave = async () => {
    if (!clanTag) {
      setMessage({ type: "error", text: "Add this clan's tag in Settings first." });
      return;
    }
    if (!text.trim()) {
      setMessage({ type: "error", text: "Paste the war data first." });
      return;
    }

    const players = parseData(text, clanLabel);
    if (players.length === 0) {
      setMessage({ type: "error", text: "Could not read any player from that data — check it's the same column format as CWL." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/save-normal-war", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clanTag,
          date,
          opponentName: opponentName.trim() || null,
          result: result || null,
          players,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      setMessage({ type: "ok", text: `Saved — ${players.length} players recorded for this war.` });
      setText("");
      setOpponentName("");
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-950 flex items-center justify-center z-50 p-4">
      <div className="border border-line rounded-md p-6 max-w-2xl w-full my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-txt-hi">Add manual war</h3>
          <button onClick={onClose} className="text-txt-low hover:text-txt-hi transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-txt-low mb-4">
          For a regular clan war the automatic sync missed. Paste the exact same
          column format you already use for CWL — it's parsed the same way.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm text-txt-low mb-1">Clan</label>
            <select
              value={clan}
              onChange={(e) => setClan(e.target.value)}
              className="w-full bg-surface-950 border border-line rounded px-3 py-2 text-txt-hi"
            >
              <option value="main">{clanNames?.main || "Main"}</option>
              <option value="secondary">{clanNames?.secondary || "Secondary"}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-txt-low mb-1">War end date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-950 border border-line rounded px-3 py-2 text-txt-hi"
            />
          </div>
          <div>
            <label className="block text-sm text-txt-low mb-1">Opponent (optional)</label>
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Opponent clan name"
              className="w-full bg-surface-950 border border-line rounded px-3 py-2 text-txt-hi"
            />
          </div>
          <div>
            <label className="block text-sm text-txt-low mb-1">Result (optional)</label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full bg-surface-950 border border-line rounded px-3 py-2 text-txt-hi"
            >
              <option value="">Unknown</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="tie">Tie</option>
            </select>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-56 bg-surface-950 border border-line rounded p-3 text-sm font-mono text-txt-hi mb-3"
          placeholder="Paste the war data here (same columns as CWL)..."
        />

        {message && (
          <div
            className={`mb-3 p-3 rounded-md text-sm border ${
              message.type === "ok"
                ? "bg-ok-900 border-ok-400/40 text-ok-400"
                : "bg-bad-900 border-bad-400/40 text-bad-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 border border-accent-400 text-accent-400 hover:bg-accent-900 disabled:opacity-50 text-txt-hi font-semibold py-3 rounded-md transition-colors"
          >
            {saving ? "Saving..." : "Save war"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-surface-700 hover:bg-surface-700 text-txt-hi font-semibold py-3 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualWarModal;
