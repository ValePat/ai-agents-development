"use client";

import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

type VariableDefinition = {
  name: string;
  description: string;
  type: "numeric" | "string";
  category: "Visual" | "Lights" | "Music";
  min?: number;
  max?: number;
  default: any;
  osc_path?: string;
};

export default function ConfigurationDashboard() {
  const [variables, setVariables] = useState<VariableDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<"Music" | "Lights" | "Visual">("Music");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New variable form state
  const [newVar, setNewVar] = useState<VariableDefinition>({
    name: "",
    description: "",
    type: "numeric",
    category: "Music",
    min: 0,
    max: 1,
    default: 0.5,
    osc_path: "",
  });

  const fetchVariables = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/orchestrator/variables`);
      if (res.ok) {
        const data = await res.json();
        setVariables(data);
      }
    } catch (error) {
      console.error("Failed to fetch variables", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVariables();
  }, []);

  const handleSaveVariable = async (v: VariableDefinition) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/orchestrator/variables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (res.ok) {
        fetchVariables();
        if (v === newVar) {
          setNewVar({
            name: "",
            description: "",
            type: "numeric",
            category: activeTab,
            min: 0,
            max: 1,
            default: 0.5,
          });
        }
      }
    } catch (error) {
      console.error("Failed to save variable", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVariable = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/orchestrator/variables/${name}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchVariables();
      }
    } catch (error) {
      console.error("Failed to delete variable", error);
    }
  };

  const filteredVariables = variables.filter((v) => v.category === activeTab);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(["Music", "Lights", "Visual"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setNewVar(prev => ({ ...prev, category: tab }));
            }}
            className={`px-6 py-3 text-sm font-bold tracking-widest uppercase transition-all ${
              activeTab === tab
                ? "text-purple-400 border-b-2 border-purple-500 bg-purple-500/5"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Variable List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {activeTab} Variables
          </h2>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 italic">Loading...</div>
          ) : filteredVariables.length === 0 ? (
            <div className="p-8 text-center text-gray-600 border border-dashed border-gray-700 rounded-2xl italic">
              No variables defined for this category.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVariables.map((v) => (
                <div
                  key={v.name}
                  className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{v.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded uppercase font-bold tracking-tighter">
                        {v.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{v.description}</p>
                    {v.type === "numeric" && (
                      <div className="text-[10px] text-gray-600 font-mono">
                        Range: [{v.min}, {v.max}] | Default: {v.default}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteVariable(v.name)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400 transition-all"
                    title="Delete variable"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Variable Form */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Add {activeTab} Variable
          </h2>
          <div className="bg-gray-800/60 border border-purple-500/20 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={newVar.name}
                onChange={(e) => setNewVar({ ...newVar, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="variable_name"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
              <textarea
                value={newVar.description}
                onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                placeholder="What does this control?"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Type</label>
                <select
                  value={newVar.type}
                  onChange={(e) => setNewVar({ ...newVar, type: e.target.value as any, default: e.target.value === "numeric" ? 0.5 : "Neutral" })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="numeric">Numeric</option>
                  <option value="string">String</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Default</label>
                <input
                  type={newVar.type === "numeric" ? "number" : "text"}
                  value={newVar.default}
                  onChange={(e) => setNewVar({ ...newVar, default: newVar.type === "numeric" ? parseFloat(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            {newVar.type === "numeric" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Min</label>
                  <input
                    type="number"
                    value={newVar.min}
                    onChange={(e) => setNewVar({ ...newVar, min: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Max</label>
                  <input
                    type="number"
                    value={newVar.max}
                    onChange={(e) => setNewVar({ ...newVar, max: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">OSC Path (Optional)</label>
              <input
                type="text"
                value={newVar.osc_path || ""}
                onChange={(e) => setNewVar({ ...newVar, osc_path: e.target.value })}
                placeholder="/custom/path"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
              />
              <p className="text-[9px] text-gray-600 italic">Defaults to /orchestrator/{newVar.name || "name"}</p>
            </div>
            <button
              onClick={() => handleSaveVariable(newVar)}
              disabled={!newVar.name || isSaving}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all text-xs uppercase tracking-widest"
            >
              {isSaving ? "Saving..." : "Add Variable"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
