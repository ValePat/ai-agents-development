"use client";

type MacroGaugeProps = {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  isOverridden: boolean;
  isInterpolating: boolean;
};

/**
 * Animated horizontal gauge for a single macro parameter.
 * Uses CSS width transition for smooth animation at 10 Hz WS updates.
 */
export default function MacroGauge({
  name,
  label,
  value,
  min,
  max,
  isOverridden,
  isInterpolating,
}: MacroGaugeProps) {
  const pct = Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));

  const barColor = isOverridden
    ? "from-amber-500 to-amber-400"
    : isInterpolating
    ? "from-purple-600 to-blue-500"
    : "from-blue-600 to-purple-500";

  const borderColor = isOverridden
    ? "border-amber-500/60"
    : isInterpolating
    ? "border-purple-500/40"
    : "border-gray-700";

  const glowClass = isOverridden
    ? "shadow-amber-500/30"
    : isInterpolating
    ? "shadow-purple-500/20"
    : "";

  return (
    <div
      className={`bg-gray-800 rounded-xl p-4 border ${borderColor} transition-all duration-300 shadow-lg ${glowClass}`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-300 tracking-wide uppercase">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {isOverridden && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full font-medium">
              PINNED
            </span>
          )}
          {isInterpolating && !isOverridden && (
            <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded-full font-medium animate-pulse">
              LIVE
            </span>
          )}
          <span className="text-lg font-mono font-bold text-white tabular-nums min-w-[3rem] text-right">
            {value.toFixed(max > 1 ? 0 : 2)}
          </span>
        </div>
      </div>

      {/* Track */}
      <div className="h-4 bg-gray-700 rounded-full overflow-hidden relative">
        {/* Fill bar */}
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-[width] duration-100 ease-linear`}
          style={{ width: `${pct}%` }}
        />
        {/* Subtle grid marks at 25%, 50%, 75% */}
        {[25, 50, 75].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 bottom-0 w-px bg-gray-600/50"
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-600">{min.toFixed(max > 1 ? 0 : 1)}</span>
        <span className="text-xs text-gray-600">{((min + max) / 2).toFixed(max > 1 ? 0 : 1)}</span>
        <span className="text-xs text-gray-600">{max.toFixed(max > 1 ? 0 : 1)}</span>
      </div>
    </div>
  );
}
