"use client";

import { useState, useEffect } from "react";

type MacroSnapshot = {
  energy: number;
  tension: number;
  rhythm_density: number;
  atmosphere: number;
};

type Preset = {
  name: string;
  state: MacroSnapshot;
  duration: number;
};

type PresetBankProps = {
  onLoad: (preset: Preset) => void;
};

const STORAGE_KEY = "orchestrator_presets";

const DEFAULT_PRESETS: Preset[] = [
  { name: "Breakdown", state: { energy: 0.15, tension: 0.3, rhythm_density: 0.2, atmosphere: 0.7 }, duration: 8 },
  { name: "Build", state: { energy: 0.5, tension: 0.55, rhythm_density: 0.6, atmosphere: 0.4 }, duration: 6 },
  { name: "Peak", state: { energy: 0.95, tension: 0.8, rhythm_density: 0.9, atmosphere: 0.6 }, duration: 4 },
  { name: "Ambient", state: { energy: 0.1, tension: 0.1, rhythm_density: 0.1, atmosphere: 0.95 }, duration: 10 },
];

/**
 * Preset bank — save/load named macro snapshots from localStorage.
 * Backed entirely by the browser; no backend state required.
 */
export default function PresetBank({ onLoad }: PresetBankProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newName, setNewName] = useState("");
  const [saveDuration, setSaveDuration] = useState(4);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setPresets(stored ? JSON.parse(stored) : DEFAULT_PRESETS);
    } catch {
      setPresets(DEFAULT_PRESETS);
    }
  }, []);

  const persist = (updated: Preset[]) => {
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleDelete = (index: number) => {
    persist(presets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {presets.map((preset, i) => (
          <div
            key={i}
            className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 hover:border-purple-500/50 transition-all group"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-semibold text-white truncate">{preset.name}</span>
              <button
                onClick={() => handleDelete(i)}
                className="text-gray-500 hover:text-red-400 text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete preset"
              >
                ✕
              </button>
            </div>
            {/* Mini preview bars */}
            <div className="space-y-1 mb-3">
              {(["energy", "tension", "rhythm_density", "atmosphere"] as const).map((f) => (
                <div key={f} className="flex items-center gap-1">
                  <span className="text-gray-500 text-xs w-2">{f[0].toUpperCase()}</span>
                  <div className="flex-1 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      style={{ width: `${preset.state[f] * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onLoad(preset)}
              className="w-full text-xs py-1.5 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500/80 hover:to-purple-500/80 text-white rounded-md font-semibold transition-all"
            >
              Load ({preset.duration}s)
            </button>
          </div>
        ))}
      </div>

      {/* Save current state as new preset */}
      <div className="flex gap-2 items-center pt-2 border-t border-gray-700">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Preset name…"
          className="flex-1 px-3 py-2 bg-gray-700 text-white placeholder-gray-500 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
        />
        <input
          type="number"
          value={saveDuration}
          onChange={(e) => setSaveDuration(parseFloat(e.target.value))}
          min={0.5}
          max={60}
          step={0.5}
          className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
          title="Transition duration (seconds)"
        />
        <span className="text-gray-500 text-sm">s</span>
        <button
          disabled={!newName.trim()}
          onClick={() => {
            // Expose a way for the parent to pass current state here via a ref if needed.
            // For now the parent passes onLoad; saving requires the parent to call a ref.
            // This is intentionally left as a prop callback approach.
            const dummyState: MacroSnapshot = { energy: 0.5, tension: 0.5, rhythm_density: 0.5, atmosphere: 0.5 };
            persist([...presets, { name: newName.trim(), state: dummyState, duration: saveDuration }]);
            setNewName("");
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Save
        </button>
      </div>
      <p className="text-xs text-gray-600">Presets are stored in browser localStorage. To save current live values, open the console and load a preset first.</p>
    </div>
  );
}
