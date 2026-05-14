"use client";

import { useState, useEffect } from "react";

type MacroDef = {
  name: string;
  description: string;
  type: "numeric" | "string";
  category: "Visual" | "Lights" | "Music";
  min?: number;
  max?: number;
  default?: any;
  osc_path?: string;
};

type Preset = {
  name: string;
  state: Record<string, number>;
  duration: number;
};

type PresetBankProps = {
  onLoad: (preset: Preset) => void;
  currentState: Record<string, number>;
  numericMacros: MacroDef[];
};

const STORAGE_KEY = "orchestrator_presets";

const DEFAULT_PRESETS: Preset[] = [
  { name: "Breakdown", state: { energy: 0.15, tension: 0.3, rhythm_density: 0.2, atmosphere: 0.7, brightness: 0.3, industrial: 0.0, glitch: 0.0 }, duration: 8 },
  { name: "Peak", state: { energy: 0.95, tension: 0.8, rhythm_density: 0.9, atmosphere: 0.6, brightness: 0.9, industrial: 0.5, glitch: 0.3 }, duration: 4 },
  { name: "Ambient", state: { energy: 0.1, tension: 0.1, rhythm_density: 0.1, atmosphere: 0.95, brightness: 0.2, industrial: 0.0, glitch: 0.0 }, duration: 10 },
];

/**
 * Preset bank — save/load named macro snapshots from localStorage.
 * Backed entirely by the browser; no backend state required.
 */
export default function PresetBank({ onLoad, currentState, numericMacros }: PresetBankProps) {
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
            className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 hover:border-purple-500/50 transition-all group flex flex-col"
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

            {/* Compact preview list */}
            <div className="space-y-1 mb-3 flex-1">
              {numericMacros.map((m) => {
                const val = preset.state[m.name];
                if (val === undefined) return null;
                return (
                  <div key={m.name} className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-400 truncate mr-1">{m.name.replace("_", " ")}</span>
                    <span className="text-gray-200 font-mono">{val.toFixed(2)}</span>
                  </div>
                );
              })}
              {/* Show warning if variables in preset are missing in current app */}
              {Object.keys(preset.state).some(k => !numericMacros.find(m => m.name === k)) && (
                <div className="text-[8px] text-amber-500/70 italic mt-1">
                  * contains legacy variables
                </div>
              )}
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
            // Capture CURRENT state of all numeric macros
            const newState: Record<string, number> = {};
            numericMacros.forEach(m => {
              // Try to get from live state, then from the variable definition's default, 
              // then hard fallback to 0.5
              const liveVal = currentState[m.name];
              newState[m.name] = (liveVal !== undefined && liveVal !== null) 
                ? liveVal 
                : (m.default !== undefined ? m.default : 0.5);
            });
            persist([...presets, { name: newName.trim(), state: newState, duration: saveDuration }]);
            setNewName("");
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Save
        </button>
      </div>
      <p className="text-xs text-gray-600">Presets are stored in browser localStorage and capture the current live values of all macros.</p>
    </div>
  );
}

