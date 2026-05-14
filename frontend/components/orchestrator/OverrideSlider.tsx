"use client";

import { useCallback, useRef, useState } from "react";

const API_BASE = "http://localhost:8000";

type OverrideSliderProps = {
  field: string;
  label: string;
  liveValue: number;     // 0.0–1.0  (from WebSocket — shown when not pinned)
  isPinned: boolean;
  onPinChange: (field: string, pinned: boolean) => void;
};

/**
 * Range slider for manual override of a single macro.
 *
 * - Dragging sends POST /orchestrator/override (debounced ~50 ms).
 * - The "Release" toggle calls DELETE /orchestrator/override/{field}.
 * - Visual state: amber border when pinned, green pulse when interpolating.
 */
export default function OverrideSlider({
  field,
  label,
  liveValue,
  isPinned,
  onPinChange,
}: OverrideSliderProps) {
  const [sliderValue, setSliderValue] = useState<number>(liveValue);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync slider display to live value when not pinned
  const displayValue = isPinned ? sliderValue : liveValue;

  const sendOverride = useCallback(
    (value: number) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          await fetch(`${API_BASE}/orchestrator/override`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field, value }),
          });
        } catch (err) {
          console.error("Override POST failed:", err);
        }
      }, 50);
    },
    [field]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSliderValue(v);
    onPinChange(field, true); // auto-pin on first move
    sendOverride(v);
  };

  const handleRelease = async () => {
    if (!isPinned) return;
    try {
      await fetch(`${API_BASE}/orchestrator/override/${field}`, {
        method: "DELETE",
      });
      onPinChange(field, false);
    } catch (err) {
      console.error("Override DELETE failed:", err);
    }
  };

  return (
    <div
      className={`bg-gray-800 rounded-xl p-4 border transition-all duration-200 ${
        isPinned ? "border-amber-500/60 shadow-lg shadow-amber-500/10" : "border-gray-700"
      }`}
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-gray-300 tracking-wide uppercase">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-base font-mono font-bold text-white tabular-nums w-10 text-right">
            {displayValue.toFixed(2)}
          </span>
          <button
            onClick={handleRelease}
            disabled={!isPinned}
            className={`text-xs px-3 py-1 rounded-full font-semibold transition-all duration-200 ${
              isPinned
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30 cursor-pointer"
                : "bg-gray-700 text-gray-500 border border-gray-600 cursor-not-allowed opacity-50"
            }`}
          >
            {isPinned ? "Release" : "Free"}
          </button>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={displayValue}
        onChange={handleChange}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer transition-all duration-200 ${
          isPinned
            ? "[&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-runnable-track]:bg-amber-900/50"
            : "[&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-runnable-track]:bg-gray-700"
        }`}
        style={{
          background: isPinned
            ? `linear-gradient(to right, rgb(245 158 11) ${displayValue * 100}%, rgb(120 53 15 / 0.5) ${displayValue * 100}%)`
            : `linear-gradient(to right, rgb(139 92 246) ${displayValue * 100}%, rgb(55 65 81) ${displayValue * 100}%)`,
        }}
      />
    </div>
  );
}
