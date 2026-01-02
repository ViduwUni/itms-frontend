export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

export function PageLoader({ label = "Loading page..." }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      {/* Animated pulse circle */}
      <div className="relative">
        <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        </div>
      </div>

      {/* Text with fade animation */}
      <div className="animate-pulse">
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-slate-100 to-slate-200 ${className}`}
    />
  );
}

// Optional: Simple progress bar
export function ProgressBar({ value = 0, max = 100, className = "" }) {
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}
    >
      <div
        className="h-full rounded-full bg-slate-600 transition-all duration-300 ease-out"
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );
}
