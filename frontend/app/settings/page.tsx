"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

type OscTarget = {
  host: string;
  port: number;
};

type OrchestratorSettings = {
  model_id: string;
  api_base: string;
  system_prompt: string;
  max_steps: number;
  temperature: number;
  max_tokens: number;
  tick_rate: number;
  default_transition_duration: number;
  min_transition_duration: number;
  osc_targets: Record<string, OscTarget>;
};

type FullSettings = {
  orchestrator: OrchestratorSettings;
};

type Toast = { id: number; text: string; type: "success" | "error" };

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function Label({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <label className="block text-xs font-medium text-gray-300 mb-1">
      {children}
      {note && <span className="ml-2 text-gray-500 font-normal">{note}</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 6,
  disabled,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      disabled={disabled}
      className={`w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y transition-colors ${mono ? "font-mono" : ""}`}
    />
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  note,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div>
      <Label note={note}>
        {label} <span className="text-blue-400 ml-1">{value}</span>
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 h-1.5 accent-blue-500 disabled:opacity-50"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-20 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>
    </div>
  );
}

function ModelSelector({
  value,
  onChange,
  suggestions,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        list="model-suggestions"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="e.g. openrouter/anthropic/claude-3-5-haiku"
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 font-mono transition-colors"
      />
      <datalist id="model-suggestions">
        {suggestions.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.slice(0, 5).map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            disabled={disabled}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
              value === m
                ? "bg-blue-600 border-blue-500 text-white"
                : "border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400"
            }`}
          >
            {m.split("/").slice(-1)[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveButton({
  onClick,
  saving,
  disabled,
}: {
  onClick: () => void;
  saving: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || saving}
      className="mt-5 flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
    >
      {saving ? (
        <>
          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Saving…
        </>
      ) : (
        "Save Changes"
      )}
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<FullSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrch, setSavingOrch] = useState(false);
  const [suggestedModels, setSuggestedModels] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((text: string, type: Toast["type"]) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Load settings on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, defaultsRes] = await Promise.all([
          fetch(`${API_BASE}/api/settings`),
          fetch(`${API_BASE}/api/settings/defaults`),
        ]);
        if (settingsRes.ok) setSettings(await settingsRes.json());
        if (defaultsRes.ok) {
          const d = await defaultsRes.json();
          setSuggestedModels(d.suggested_models ?? []);
        }
      } catch (err) {
        addToast("Failed to load settings from backend", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [addToast]);

  // ── Patch helpers ──────────────────────────────────────────────────────────
  const patchOrch = (patch: Partial<OrchestratorSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, orchestrator: { ...settings.orchestrator, ...patch } });
  };

  // ── Save handlers ──────────────────────────────────────────────────────────
  const saveOrch = async () => {
    if (!settings) return;
    setSavingOrch(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/orchestrator`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.orchestrator),
      });
      if (res.ok) {
        addToast("Orchestrator settings saved. LLM params applied immediately.", "success");
      } else {
        const err = await res.json();
        addToast(`Save failed: ${err.detail ?? res.statusText}`, "error");
      }
    } catch (e) {
      addToast("Network error — is the backend running?", "error");
    } finally {
      setSavingOrch(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 bg-gray-950 min-h-full">
      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-sm shadow-lg pointer-events-auto animate-fade-in ${
              t.type === "success"
                ? "bg-emerald-700 text-white"
                : "bg-red-700 text-white"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Page header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link 
            href="/"
            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">System Settings</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Model, Engine & System Prompts</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
          <span className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mr-3" />
          Loading settings…
        </div>
      ) : !settings ? (
        <div className="flex items-center justify-center h-64 text-red-400 text-sm">
          Could not load settings. Ensure the backend is running on port 8000.
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="space-y-8">
            {/* Model */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
              <SectionHeader
                title="LLM Model Selection"
                subtitle="The model used for semantic prompt → macro target translation. Applied immediately on save."
              />
              <div>
                <Label note="openrouter/{provider}/{model}">Model ID</Label>
                <ModelSelector
                  value={settings.orchestrator.model_id}
                  onChange={(v) => patchOrch({ model_id: v })}
                  suggestions={suggestedModels}
                />
              </div>
              <div>
                <Label note="Provider API endpoint">API Base URL</Label>
                <TextInput
                  value={settings.orchestrator.api_base}
                  onChange={(v) => patchOrch({ api_base: v })}
                  placeholder="https://openrouter.ai/api/v1"
                />
              </div>
            </div>

            {/* Sampling */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
              <SectionHeader
                title="LLM Sampling Parameters"
                subtitle="Applied immediately to every subsequent /orchestrator/prompt request."
              />
              <SliderRow
                label="Temperature"
                value={settings.orchestrator.temperature}
                onChange={(v) => patchOrch({ temperature: v })}
                min={0}
                max={2}
                step={0.05}
                note="Lower = more predictable macro output"
              />
              <SliderRow
                label="Max Tokens"
                value={settings.orchestrator.max_tokens}
                onChange={(v) => patchOrch({ max_tokens: v })}
                min={64}
                max={4096}
                step={64}
                note="Maximum tokens in the LLM response"
              />
              <SliderRow
                label="Max Retries"
                value={settings.orchestrator.max_steps}
                onChange={(v) => patchOrch({ max_steps: v })}
                min={1}
                max={50}
                step={1}
                note="JSON-extraction retries if model returns malformed output"
              />
            </div>

            {/* System Prompt */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <SectionHeader
                title="System Prompt"
                subtitle="The complete system instructions for the orchestrator agent. Placeholders are resolved in real-time before sending to the LLM."
              />
              <Label>Instructions</Label>
              <TextArea
                value={settings.orchestrator.system_prompt}
                onChange={(v) => patchOrch({ system_prompt: v })}
                rows={20}
                mono
              />
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500">
                  Available Placeholders:
                </p>
                <ul className="text-[10px] font-mono text-gray-400 list-disc list-inside space-y-1">
                  <li><code className="text-blue-400">{"{{{VARIABLE_DEFINITIONS}}}"}</code> - Dynamically generated list of macros from the Config page.</li>
                  <li><code className="text-blue-400">{"{{{CURRENT_STATE}}}"}</code> - Current numeric and string values of the show macros.</li>
                  <li><code className="text-blue-400">{"{{{SHOW_CONTEXT}}}"}</code> - Active show name, description, genres, and core vibes.</li>
                  <li><code className="text-blue-400">{"{{{SHOW_ID}}}"}</code> - Active show ID (use as prefix for memory keys).</li>
                </ul>
                <p className="text-[10px] text-gray-500 mt-1">Note: Triple braces are required to avoid Jinja2 rendering conflicts. You have full control over the prompt structure; ensuring the model returns valid JSON is critical for system stability.</p>
              </div>
            </div>

            {/* OSC Configuration */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-6">
              <SectionHeader
                title="OSC Targets"
                subtitle="Configure multiple targets based on variable categories (Music, Visual, Lights). Rebinds on save."
              />
              <div className="space-y-6">
                {Object.entries(settings.orchestrator.osc_targets).map(([category, target]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {category} Target
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label note="Target IP address">Host</Label>
                        <TextInput
                          value={target.host}
                          onChange={(v) => {
                            const newTargets = { ...settings.orchestrator.osc_targets };
                            newTargets[category] = { ...target, host: v };
                            patchOrch({ osc_targets: newTargets });
                          }}
                          placeholder="127.0.0.1"
                        />
                      </div>
                      <div>
                        <Label note="UDP Port">Port</Label>
                        <TextInput
                          value={target.port.toString()}
                          onChange={(v) => {
                            const newTargets = { ...settings.orchestrator.osc_targets };
                            newTargets[category] = { ...target, port: parseInt(v) || 0 };
                            patchOrch({ osc_targets: newTargets });
                          }}
                          placeholder="9000"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transition settings */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
              <SectionHeader
                title="Interpolation Engine"
                subtitle="Low-level engine timing. tick_rate and duration changes are persisted; tick_rate requires a restart."
              />
              <SliderRow
                label="Tick Rate (Hz)"
                value={settings.orchestrator.tick_rate}
                onChange={(v) => patchOrch({ tick_rate: v })}
                min={10}
                max={120}
                step={10}
                note="Interpolation loop frequency — restart required"
              />
              <SliderRow
                label="Default Transition Duration (s)"
                value={settings.orchestrator.default_transition_duration}
                onChange={(v) => patchOrch({ default_transition_duration: v })}
                min={0.1}
                max={120}
                step={0.5}
                note="Fallback duration when LLM omits it"
              />
              <SliderRow
                label="Min Transition Duration (s)"
                value={settings.orchestrator.min_transition_duration}
                onChange={(v) => patchOrch({ min_transition_duration: v })}
                min={0.1}
                max={10}
                step={0.1}
                note="Floor for LLM-suggested or override durations"
              />
            </div>

            <SaveButton onClick={saveOrch} saving={savingOrch} />
          </div>
        </div>
      )}
    </div>
  );
}
