"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:8000";

type OverrideSliderProps = {
  field: string;
  label: string;
  liveValue: number;     // from WebSocket — shown when not pinned
  min: number;
  max: number;
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
  min,
  max,
  isPinned,
  onPinChange,
}: OverrideSliderProps) {
  const [sliderValue, setSliderValue] = useState<number>(liveValue);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync slider display to live value when not pinned
  // This prevents the slider from "jumping" to an old value when first clicked
  useEffect(() => {
    if (!isPinned) {
      setSliderValue(liveValue);
    }
  }, [liveValue, isPinned]);

  const displayValue = isPinned ? sliderValue : liveValue;
  const percentage = ((displayValue - min) / (max - min)) * 100;

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
    if (!isPinned) {
      onPinChange(field, true);
    }
    sendOverride(v);
  };

  const handlePointerDown = () => {
    if (!isPinned) {
      onPinChange(field, true);
      sendOverride(sliderValue);
    }
  };

  const handleRelease = async () => {
    if (!isPinned) return;
    try {
      // Optimistically unpin to avoid UI lag
      onPinChange(field, false);
      await fetch(`${API_BASE}/orchestrator/override/${field}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Override DELETE failed:", err);
      // Rollback on failure? (optional)
      onPinChange(field, true);
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
          <span className="text-base font-mono font-bold text-white tabular-nums min-w-[3rem] text-right">
            {displayValue.toFixed(max > 1 ? 0 : 2)}
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
        min={min}
        max={max}
        step={max > 1 ? 1 : 0.01}
        value={displayValue}
        onChange={handleChange}
        onPointerDown={handlePointerDown}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer transition-all duration-200 ${
          isPinned
            ? "[&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-runnable-track]:bg-amber-900/50"
            : "[&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-runnable-track]:bg-gray-700"
        }`}
        style={{
          background: isPinned
            ? `linear-gradient(to right, rgb(245 158 11) ${percentage}%, rgb(120 53 15 / 0.5) ${percentage}%)`
            : `linear-gradient(to right, rgb(139 92 246) ${percentage}%, rgb(55 65 81) ${percentage}%)`,
        }}
      />
    </div>
  );
}
