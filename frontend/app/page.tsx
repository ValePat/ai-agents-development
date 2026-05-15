"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import MacroGauge from "@/components/orchestrator/MacroGauge";
import OverrideSlider from "@/components/orchestrator/OverrideSlider";
import PresetBank from "@/components/orchestrator/PresetBank";

const API_BASE = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/orchestrator/ws";

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

type ToastMsg = {
  id: number;
  text: string;
  type: "success" | "error" | "info";
};

type MacroState = Record<string, any>;

export default function OrchestratorPage() {
  // ── Dynamic variable definitions ─────────────────────────────────────────
  const [numericMacros, setNumericMacros] = useState<MacroDef[]>([]);
  const [stringMacros, setStringMacros] = useState<MacroDef[]>([]);
  // Refs so the WebSocket closure always sees the latest variable lists
  const numericMacrosRef = useRef<MacroDef[]>([]);
  const stringMacrosRef = useRef<MacroDef[]>([]);

  // ── Show state ────────────────────────────────────────────────────────────
  const [activeShow, setActiveShow] = useState<any | null>(null);
  const [availableShows, setAvailableShows] = useState<any[]>([]);

  // ── WebSocket state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<any | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const currentRef = useRef<Record<string, any>>({});

  // ── Prompt zone ──────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<(MacroState & { duration: number }) | null>(null);

  // ── Override zone ────────────────────────────────────────────────────────
  const [pinnedFields, setPinnedFields] = useState<Set<string>>(new Set());
  const lastInteractionRef = useRef<Record<string, number>>({});

  // ── Rehearsal panel ──────────────────────────────────────────────────────
  const [zoneBOpen, setZoneBOpen] = useState(true);
  const [zoneCOpen, setZoneCOpen] = useState(false);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [oscLog, setOscLog] = useState<string[]>([]);

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((text: string, type: ToastMsg["type"] = "info") => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Fetch shows ──────────────────────────────────────────────────────────
  const fetchShows = useCallback(async () => {
    try {
      const [allRes, activeRes] = await Promise.all([
        fetch(`${API_BASE}/orchestrator/shows`),
        fetch(`${API_BASE}/orchestrator/shows/active`)
      ]);
      if (allRes.ok) setAvailableShows(await allRes.json());
      if (activeRes.ok) setActiveShow(await activeRes.json());
    } catch (err) {
      console.error("Failed to fetch shows", err);
    }
  }, []);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  const handleSwitchShow = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/shows/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchShows();
        addToast(`Switched to show: ${id}`, "success");
      }
    } catch (err) {
      addToast("Failed to switch show", "error");
    }
  };

  // ── Fetch variable definitions ───────────────────────────────────────────
  const fetchVars = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/variables`);
      if (res.ok) {
        const data: MacroDef[] = await res.json();
        setNumericMacros(data.filter((v) => v.type === "numeric"));
        setStringMacros(data.filter((v) => v.type === "string"));
      }
    } catch (err) {
      console.error("Failed to fetch variables", err);
    }
  }, []);

  useEffect(() => {
    fetchVars();
  }, [fetchVars, activeShow?.id]);

  // Keep refs in sync so the WebSocket closure always sees the latest lists
  useEffect(() => {
    numericMacrosRef.current = numericMacros;
  }, [numericMacros]);

  useEffect(() => {
    stringMacrosRef.current = stringMacros;
  }, [stringMacros]);

  // ── WebSocket connection ─────────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (ev) => {
        try {
          const data: any = JSON.parse(ev.data);
          setStatus(data);
          currentRef.current = data.current;
          
          // Sync pinned fields from server, but ignore recently changed ones to avoid flicker
          const serverPinned = data.pinned_fields || [];
          setPinnedFields((prev) => {
            const now = Date.now();
            const reconciled = new Set(prev);
            
            // 1. Add anything from server that we haven't touched recently
            serverPinned.forEach((f: string) => {
              if (now - (lastInteractionRef.current[f] || 0) > 1500) {
                reconciled.add(f);
              }
            });
            // 2. Remove anything NOT in server that we haven't touched recently
            prev.forEach(f => {
              if (!serverPinned.includes(f) && (now - (lastInteractionRef.current[f] || 0) > 1500)) {
                reconciled.delete(f);
              }
            });
            return reconciled;
          });

          // Add to OSC log (last 30 entries)
          const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
          const vals = data.current;
          
          // Construct log string dynamically (use refs to avoid stale closure)
          const numericParts = numericMacrosRef.current
            .map(m => `${m.osc_path || "/orchestrator/" + m.name}:${vals[m.name]?.toFixed(2) ?? "?"}`);
          const stringParts = stringMacrosRef.current
            .map(m => `${m.osc_path || "/orchestrator/" + m.name}:"${vals[m.name] ?? ""}"`);
          const logEntry = [...numericParts, ...stringParts].join(" ");
            
          setOscLog((prev) =>
            [
              `${ts} ${logEntry}`,
              ...prev,
            ].slice(0, 30)
          );
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // ── Prompt submit ────────────────────────────────────────────────────────
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setPreviewTarget(null);

    try {
      const res = await fetch(`${API_BASE}/orchestrator/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: prompt.trim(), 
          duration,
          show_id: activeShow?.id || "default_show"
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Prompt failed");
      }

      const target = await res.json();
      setPreviewTarget(target);
      addToast(`Target set successfully (${target.duration}s)`, "success");
    } catch (err) {
      addToast(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Override pin/release callbacks ───────────────────────────────────────
  const handlePinChange = useCallback((field: string, pinned: boolean) => {
    lastInteractionRef.current[field] = Date.now();
    setPinnedFields((prev) => {
      const next = new Set(prev);
      if (pinned) next.add(field);
      else next.delete(field);
      return next;
    });
  }, []);

  // ── Preset load ──────────────────────────────────────────────────────────
  const handlePresetLoad = async (preset: {
    state: any;
    duration: number;
    name: string;
  }) => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/target`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...preset.state,
          duration: preset.duration,
        }),
      });
      if (!res.ok) throw new Error("Preset load failed");
      addToast(`Preset "${preset.name}" loaded (${preset.duration}s)`, "info");
    } catch (err) {
      addToast(`Preset error: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    }
  };

  const current = status?.current ?? {};
  const isInterp = status?.is_interpolating ?? false;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-purple-500/20 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-sm">
              O
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Show Orchestrator</h1>
              <p className="text-xs text-gray-500">Real-time macro director</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Show Selector */}
            <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Show</span>
              <select
                value={activeShow?.id || "default_show"}
                onChange={(e) => handleSwitchShow(e.target.value)}
                className="bg-transparent text-xs font-bold text-purple-400 focus:outline-none cursor-pointer"
              >
                {availableShows.map(s => (
                  <option key={s.id} value={s.id} className="bg-gray-800">{s.name}</option>
                ))}
              </select>
              <Link href="/shows" className="ml-1 text-gray-500 hover:text-purple-400" title="Manage Shows">
                ⚙️
              </Link>
            </div>
            {/* WS status indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
              />
              <span className="text-xs text-gray-400">{wsConnected ? "Live" : "Offline"}</span>
            </div>
            <Link
              href="/config"
              className="text-sm text-purple-400 hover:text-purple-300 font-bold transition-all"
            >
              Config →
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* ── EXPRESSION ZONE: Vibe & Scene ────────────────────────────────── */}
        <section className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-5 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-6">
            {stringMacros.map((m) => (
              <div key={m.name} className="flex-1 space-y-1">
                <h2 className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">{m.name.replace("_", " ")}</h2>
                <p className="text-2xl font-black text-white tracking-tight uppercase italic">
                  {current[m.name] || "..."}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── ZONE A: Prompt Input ─────────────────────────────────────────── */}
        <section className="bg-gray-800/60 border border-purple-500/20 rounded-2xl p-5 shadow-xl">
          <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-4">
            Zone A — Semantic Direction
          </h2>
          <form onSubmit={handlePromptSubmit} className="space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the desired show state… e.g. 'Build tension slowly towards a climax' or 'Drop into a sparse, ambient breakdown'"
              rows={3}
              className="w-full px-4 py-3 bg-gray-700 text-white placeholder-gray-500 rounded-xl border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:outline-none transition-all resize-none text-sm"
            />
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 whitespace-nowrap">Duration</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                  min={0.5}
                  max={120}
                  step={0.5}
                  className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
                />
                <span className="text-sm text-gray-500">s</span>
                <span className="text-xs text-gray-600 ml-1">(overrides LLM suggestion)</span>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !prompt.trim()}
                className="sm:ml-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
              >
                {isSubmitting ? "Translating…" : "Send to Orchestrator"}
              </button>
            </div>
          </form>

          {/* Preview toast for LLM target */}
          {previewTarget && (
            <div className="mt-4 p-3 bg-purple-900/30 border border-purple-500/40 rounded-xl">
              <p className="text-xs font-semibold text-purple-400 mb-2">LLM Target Preview</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-gray-300">
                {numericMacros.map((m) => (
                  <div key={m.name} className="flex justify-between bg-gray-700/50 rounded-lg px-2 py-1">
                    <span className="text-gray-400">{m.name}</span>
                    <span className="font-mono font-bold text-white">
                      {previewTarget[m.name]?.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between bg-gray-700/50 rounded-lg px-2 py-1">
                  <span className="text-gray-400">Dur</span>
                  <span className="font-mono font-bold text-white">{previewTarget.duration}s</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── ZONE B: Live Macro Visualizer ────────────────────────────────── */}
        <section className="bg-gray-800/60 border border-gray-700/50 rounded-2xl shadow-xl overflow-hidden">
          <button
            onClick={() => setZoneBOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-700/30 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
                Zone B — Live Macros
              </h2>
              {isInterp && status && (
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-gray-500">
                    {Math.max(0, status.target.duration - status.elapsed_seconds).toFixed(1)}s
                  </div>
                  <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-[width] duration-100"
                      style={{
                        width: `${Math.min(100, (status.elapsed_seconds / status.target.duration) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <span className="text-gray-500 text-sm">{zoneBOpen ? "▲ Close" : "▼ Open"}</span>
          </button>

          {zoneBOpen && (
            <div className="px-5 pb-5 border-t border-gray-700/40 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {numericMacros.map((m) => (
                  <MacroGauge
                    key={m.name}
                    name={m.name}
                    label={m.name.replace("_", " ")}
                    value={current[m.name] || 0}
                    min={m.min ?? 0}
                    max={m.max ?? 1}
                    isOverridden={pinnedFields.has(m.name)}
                    isInterpolating={isInterp && !pinnedFields.has(m.name)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── ZONE C: Emergency Override Panel ────────────────────────────── */}
        <section className="bg-gray-800/60 border border-gray-700/50 rounded-2xl shadow-xl overflow-hidden">
          <button
            onClick={() => setZoneCOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-700/30 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                Zone C — Emergency Override
              </h2>
              {pinnedFields.size > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold">
                  {pinnedFields.size} PINNED
                </span>
              )}
            </div>
            <span className="text-gray-500 text-sm">{zoneCOpen ? "▲ Close" : "▼ Open"}</span>
          </button>

          {zoneCOpen && (
            <div className="px-5 pb-5 border-t border-gray-700/40 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {numericMacros.map((m) => (
                  <OverrideSlider
                    key={m.name}
                    field={m.name}
                    label={m.name.replace("_", " ")}
                    liveValue={current[m.name] || 0}
                    min={m.min ?? 0}
                    max={m.max ?? 1}
                    isPinned={pinnedFields.has(m.name)}
                    onPinChange={handlePinChange}
                  />
                ))}
              </div>
              {pinnedFields.size > 0 && (
                <div className="mt-4 flex items-center justify-between bg-amber-900/20 border border-amber-500/30 rounded-xl p-3">
                  <span className="text-sm text-amber-400">
                    {pinnedFields.size} field{pinnedFields.size > 1 ? "s" : ""} pinned
                  </span>
                  <button
                    onClick={async () => {
                      for (const f of pinnedFields) {
                        await fetch(`${API_BASE}/orchestrator/override/${f}`, { method: "DELETE" });
                      }
                      setPinnedFields(new Set());
                      addToast("All overrides released", "info");
                    }}
                    className="text-xs px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-full hover:bg-amber-500/30 transition-all"
                  >
                    Release All
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── REHEARSAL PANEL (Phase 4) ────────────────────────────────────── */}
        <section className="bg-gray-800/40 border border-gray-700/30 rounded-2xl shadow-xl overflow-hidden">
          <button
            onClick={() => setRehearsalOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-700/30 transition-colors text-left"
          >
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Rehearsal Panel
            </h2>
            <span className="text-gray-500 text-sm">{rehearsalOpen ? "▲ Close" : "▼ Open"}</span>
          </button>

          {rehearsalOpen && (
            <div className="px-5 pb-5 space-y-6 border-t border-gray-700/40">
              {/* Preset Bank */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-4">
                  Preset Bank
                </h3>
                <PresetBank 
                  onLoad={handlePresetLoad} 
                  currentStateRef={currentRef}
                  numericMacros={numericMacros}
                  showId={activeShow?.id}
                  builtInPresets={activeShow?.presets}
                />
              </div>

              {/* OSC Monitor */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  OSC Monitor
                  <span className="ml-2 text-gray-600 normal-case font-normal">
                    (last {oscLog.length} frames at 10 Hz)
                  </span>
                </h3>
                <div className="bg-gray-900 rounded-xl p-3 h-40 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5 border border-gray-700">
                  {oscLog.length === 0 ? (
                    <span className="text-gray-600">No data yet — connect WebSocket to see frames.</span>
                  ) : (
                    oscLog.map((line, i) => (
                      <div key={i} className={i === 0 ? "text-green-300" : "text-green-600"}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Calibration */}
              <CalibrationPanel addToast={addToast} macros={numericMacros} />
            </div>
          )}
        </section>
      </main>

      {/* Navigation Footer */}
      <footer className="flex-shrink-0 border-t border-gray-800 bg-gray-900/50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-center gap-8">
          <Link href="/config" className="flex flex-col items-center gap-1 group">
            <span className="text-lg group-hover:scale-110 transition-transform">📊</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-purple-400">Variables</span>
          </Link>
          <Link href="/shows" className="flex flex-col items-center gap-1 group">
            <span className="text-lg group-hover:scale-110 transition-transform">🎭</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-blue-400">Shows</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 group">
            <span className="text-lg group-hover:scale-110 transition-transform">⚙️</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-amber-400">Settings</span>
          </Link>
        </div>
      </footer>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all animate-in slide-in-from-right-4 fade-in pointer-events-auto max-w-sm ${
              t.type === "success"
                ? "bg-green-900/90 border-green-500/50 text-green-300"
                : t.type === "error"
                ? "bg-red-900/90 border-red-500/50 text-red-300"
                : "bg-gray-800/90 border-gray-600/50 text-gray-300"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calibration sub-panel ────────────────────────────────────────────────────

type CalibrationPanelProps = {
  addToast: (text: string, type: "success" | "error" | "info") => void;
  macros: MacroDef[];
};

type CalibrationState = {
  [key: string]: number;
};

function CalibrationPanel({ addToast, macros }: CalibrationPanelProps) {
  const [cal, setCal] = useState<CalibrationState>({});

  // Initialize calibration state when macros load
  useEffect(() => {
    const initialCal: CalibrationState = {};
    macros.forEach((m) => {
      initialCal[`${m.name}_min`] = m.min ?? 0;
      initialCal[`${m.name}_max`] = m.max ?? 1;
    });
    setCal(initialCal);
  }, [macros]);

  const handleApply = async () => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cal),
      });
      if (!res.ok) throw new Error("Calibration failed");
      addToast("Calibration applied", "success");
    } catch (err) {
      addToast(`Calibration error: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    }
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Output Clamping Calibration
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {macros.map((m) => (
          <div key={m.name} className="bg-gray-700/40 rounded-xl p-3 space-y-2">
            <span className="text-sm font-semibold text-gray-300">{m.name.replace("_", " ")}</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-7">Min</label>
              <input
                type="range" min={m.min ?? 0} max={m.max ?? 1} step={0.01}
                value={cal[`${m.name}_min`] ?? (m.min ?? 0)}
                onChange={(e) => setCal((c) => ({ ...c, [`${m.name}_min`]: parseFloat(e.target.value) }))}
                className="flex-1 h-1.5 accent-blue-500"
              />
              <span className="text-xs font-mono text-gray-400 w-8">{(cal[`${m.name}_min`] ?? (m.min ?? 0)).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-7">Max</label>
              <input
                type="range" min={m.min ?? 0} max={m.max ?? 1} step={0.01}
                value={cal[`${m.name}_max`] ?? (m.max ?? 1)}
                onChange={(e) => setCal((c) => ({ ...c, [`${m.name}_max`]: parseFloat(e.target.value) }))}
                className="flex-1 h-1.5 accent-purple-500"
              />
              <span className="text-xs font-mono text-gray-400 w-8">{(cal[`${m.name}_max`] ?? (m.max ?? 1)).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleApply}
        className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500/80 hover:to-purple-500/80 text-white text-sm font-semibold rounded-xl transition-all"
      >
        Apply Calibration
      </button>
    </div>
  );
}
