"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MacroGauge from "@/components/orchestrator/MacroGauge";
import OverrideSlider from "@/components/orchestrator/OverrideSlider";
import PresetBank from "@/components/orchestrator/PresetBank";

const API_BASE = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/orchestrator/ws";

// Macro metadata
const MACROS = [
  { field: "energy", label: "Energy" },
  { field: "tension", label: "Tension" },
  { field: "rhythm_density", label: "Rhythm Density" },
  { field: "atmosphere", label: "Atmosphere" },
] as const;

type MacroField = (typeof MACROS)[number]["field"];

type MacroState = {
  energy: number;
  tension: number;
  rhythm_density: number;
  atmosphere: number;
};

type OrchestratorStatus = {
  current: MacroState;
  target: MacroState & { duration: number };
  is_interpolating: boolean;
  elapsed_seconds: number;
  pinned_fields: string[];
};

type ToastMsg = {
  id: number;
  text: string;
  type: "success" | "error" | "info";
};

export default function OrchestratorPage() {
  // ── WebSocket state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Prompt zone ──────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<(MacroState & { duration: number }) | null>(null);

  // ── Override zone ────────────────────────────────────────────────────────
  const [pinnedFields, setPinnedFields] = useState<Set<string>>(new Set());

  // ── Rehearsal panel ──────────────────────────────────────────────────────
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
          const data: OrchestratorStatus = JSON.parse(ev.data);
          setStatus(data);
          // Sync pinned fields from server
          setPinnedFields(new Set(data.pinned_fields));
          // Add to OSC log (last 30 entries)
          const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
          const vals = data.current;
          setOscLog((prev) =>
            [
              `${ts} E:${vals.energy.toFixed(3)} T:${vals.tension.toFixed(3)} R:${vals.rhythm_density.toFixed(3)} A:${vals.atmosphere.toFixed(3)}`,
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
        body: JSON.stringify({ prompt: prompt.trim(), duration }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Prompt failed");
      }

      const target = await res.json();
      setPreviewTarget(target);
      addToast(`Target set: E${target.energy.toFixed(2)} T${target.tension.toFixed(2)} R${target.rhythm_density.toFixed(2)} A${target.atmosphere.toFixed(2)} (${target.duration}s)`, "success");
    } catch (err) {
      addToast(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Override pin/release callbacks ───────────────────────────────────────
  const handlePinChange = useCallback((field: string, pinned: boolean) => {
    setPinnedFields((prev) => {
      const next = new Set(prev);
      if (pinned) next.add(field);
      else next.delete(field);
      return next;
    });
  }, []);

  // ── Preset load ──────────────────────────────────────────────────────────
  const handlePresetLoad = async (preset: {
    state: MacroState;
    duration: number;
    name: string;
  }) => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Load preset: ${preset.name}`,
          duration: preset.duration,
        }),
      });
      if (!res.ok) throw new Error("Preset load failed");
      addToast(`Preset "${preset.name}" loaded (${preset.duration}s)`, "info");
    } catch (err) {
      addToast(`Preset error: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    }
  };

  const current = status?.current ?? { energy: 0.5, tension: 0.5, rhythm_density: 0.5, atmosphere: 0.5 };
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
            {/* WS status indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
              />
              <span className="text-xs text-gray-400">{wsConnected ? "Live" : "Offline"}</span>
            </div>
            <a
              href="/"
              className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
            >
              ← Chat
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
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
                {MACROS.map(({ field, label }) => (
                  <div key={field} className="flex justify-between bg-gray-700/50 rounded-lg px-2 py-1">
                    <span className="text-gray-400">{label.split(" ")[0]}</span>
                    <span className="font-mono font-bold text-white">
                      {previewTarget[field as MacroField]?.toFixed(2)}
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
        <section className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Zone B — Live Macros
            </h2>
            {isInterp && status && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">
                  {Math.max(0, status.target.duration - status.elapsed_seconds).toFixed(1)}s remaining
                </div>
                <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MACROS.map(({ field, label }) => (
              <MacroGauge
                key={field}
                name={field}
                label={label}
                value={current[field as MacroField]}
                isOverridden={pinnedFields.has(field)}
                isInterpolating={isInterp && !pinnedFields.has(field)}
              />
            ))}
          </div>
        </section>

        {/* ── ZONE C: Emergency Override Panel ────────────────────────────── */}
        <section className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
            Zone C — Emergency Override
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MACROS.map(({ field, label }) => (
              <OverrideSlider
                key={field}
                field={field}
                label={label}
                liveValue={current[field as MacroField]}
                isPinned={pinnedFields.has(field)}
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
                <PresetBank onLoad={handlePresetLoad} />
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
              <CalibrationPanel addToast={addToast} />
            </div>
          )}
        </section>
      </main>

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
};

type CalibrationState = {
  [key: string]: number;
};

function CalibrationPanel({ addToast }: CalibrationPanelProps) {
  const [cal, setCal] = useState<CalibrationState>({
    energy_min: 0,   energy_max: 1,
    tension_min: 0,  tension_max: 1,
    rhythm_density_min: 0, rhythm_density_max: 1,
    atmosphere_min: 0, atmosphere_max: 1,
  });

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
        {MACROS.map(({ field, label }) => (
          <div key={field} className="bg-gray-700/40 rounded-xl p-3 space-y-2">
            <span className="text-sm font-semibold text-gray-300">{label}</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-7">Min</label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={cal[`${field}_min`]}
                onChange={(e) => setCal((c) => ({ ...c, [`${field}_min`]: parseFloat(e.target.value) }))}
                className="flex-1 h-1.5 accent-blue-500"
              />
              <span className="text-xs font-mono text-gray-400 w-8">{cal[`${field}_min`].toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-7">Max</label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={cal[`${field}_max`]}
                onChange={(e) => setCal((c) => ({ ...c, [`${field}_max`]: parseFloat(e.target.value) }))}
                className="flex-1 h-1.5 accent-purple-500"
              />
              <span className="text-xs font-mono text-gray-400 w-8">{cal[`${field}_max`].toFixed(2)}</span>
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
