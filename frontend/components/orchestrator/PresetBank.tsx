"use client";

import { useState, useEffect, memo, RefObject } from "react";

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
  state: Record<string, any>;
  duration: number;
};

// ... (types unchanged)

/**
 * Compact card for a single preset.
 * Memoized to prevent re-renders when live status updates.
 */
const PresetCard = memo(({ 
  preset, 
  onLoad, 
  onDel, 
  isBuiltIn, 
  numericMacros 
}: { 
  preset: Preset, 
  onLoad: (p: Preset) => void,
  onDel?: () => void, 
  isBuiltIn?: boolean,
  numericMacros: MacroDef[]
}) => (
  <div
    className={`bg-gray-700/50 border rounded-lg p-3 hover:border-purple-500/50 transition-all group flex flex-col ${isBuiltIn ? "border-blue-500/20 shadow-lg shadow-blue-500/5" : "border-gray-600"}`}
  >
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold text-white truncate">{preset.name}</span>
        {isBuiltIn && (
          <span className="shrink-0 text-[7px] bg-blue-600 text-white px-1 py-0.5 rounded font-bold uppercase tracking-tighter">Template</span>
        )}
      </div>
      {!isBuiltIn && onDel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDel();
          }}
          className="text-gray-500 hover:text-red-400 text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete preset"
        >
          ✕
        </button>
      )}
    </div>

    {/* Compact preview list of the preset's values */}
    <div className="space-y-1 mb-3 flex-1 overflow-hidden">
      {numericMacros.map((m) => {
        const val = preset.state[m.name];
        if (val === undefined) return null;
        return (
          <div key={m.name} className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400 truncate mr-1">{m.name.replace("_", " ")}</span>
            <span className="text-gray-200 font-mono">{typeof val === 'number' ? val.toFixed(2) : '---'}</span>
          </div>
        );
      })}
      {/* String preview if any */}
      {Object.entries(preset.state).map(([k, v]) => {
        if (typeof v === 'string' && k === 'scene_description') {
          return (
            <div key={k} className="mt-1 text-[9px] text-gray-500 italic line-clamp-1 border-t border-gray-600/30 pt-1">
              "{v}"
            </div>
          );
        }
        return null;
      })}
    </div>

    <button
      onClick={() => onLoad(preset)}
      className="w-full text-[10px] py-1 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500/80 hover:to-purple-500/80 text-white rounded-md font-bold transition-all shadow-md active:scale-95"
    >
      LOAD ({preset.duration}s)
    </button>
  </div>
));

PresetCard.displayName = "PresetCard";

type PresetBankProps = {
  onLoad: (preset: Preset) => void;
  currentStateRef: RefObject<Record<string, any>>;
  numericMacros: MacroDef[];
  showId?: string;
  builtInPresets?: Preset[];
};

/**
 * Preset bank — save/load named macro snapshots from localStorage.
 * Backed entirely by the browser; no backend state required.
 * Presets are isolated per showId.
 */
export default function PresetBank({ onLoad, currentStateRef, numericMacros, showId = "default_show", builtInPresets = [] }: PresetBankProps) {
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [newName, setNewName] = useState("");
  const [saveDuration, setSaveDuration] = useState(4);

  const storageKey = `orchestrator_presets_${showId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setUserPresets(stored ? JSON.parse(stored) : []);
    } catch {
      setUserPresets([]);
    }
  }, [storageKey]);

  const persist = (updated: Preset[]) => {
    setUserPresets(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleDelete = (index: number) => {
    persist(userPresets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      {builtInPresets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Show Templates</h4>
            <div className="flex-1 h-[1px] bg-blue-500/20" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {builtInPresets.map((preset, i) => (
              <PresetCard 
                key={`builtin-${i}`} 
                preset={preset} 
                onLoad={onLoad}
                numericMacros={numericMacros}
                isBuiltIn 
              />
            ))}
          </div>
        </div>
      )}

      {/* User Presets Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">User States</h4>
          <div className="flex-1 h-[1px] bg-gray-700/50" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {userPresets.map((preset, i) => (
            <PresetCard 
              key={`user-${i}`} 
              preset={preset} 
              onLoad={onLoad}
              numericMacros={numericMacros}
              onDel={() => handleDelete(i)} 
            />
          ))}
          {userPresets.length === 0 && (
            <div className="col-span-full py-6 border-2 border-dashed border-gray-800/50 rounded-xl flex flex-col items-center justify-center text-[10px] text-gray-600 gap-1 uppercase tracking-widest font-bold">
              <span>No custom presets</span>
              <span className="text-[8px] font-normal lowercase tracking-normal italic opacity-60">Snapshot the current state below</span>
            </div>
          )}
        </div>
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
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) setSaveDuration(val);
          }}
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
            // Capture CURRENT state of all numeric macros via the Ref
            const currentState = currentStateRef.current || {};
            const newState: Record<string, number> = {};
            numericMacros.forEach(m => {
              const liveVal = currentState[m.name];
              newState[m.name] = (liveVal !== undefined && liveVal !== null) 
                ? liveVal 
                : (m.default !== undefined ? m.default : 0.5);
            });
            persist([...userPresets, { name: newName.trim(), state: newState, duration: saveDuration }]);
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

