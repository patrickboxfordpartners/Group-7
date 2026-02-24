'use client';

export function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? 'text-emerald-400'
      : score >= 60
        ? 'text-amber-400'
        : 'text-red-400';
  const glowColor =
    score >= 80
      ? 'rgba(16,185,129,0.10)'
      : score >= 60
        ? 'rgba(245,158,11,0.10)'
        : 'rgba(239,68,68,0.10)';

  return (
    <div className="relative mx-auto h-36 w-36">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
      />
      <svg viewBox="0 0 120 120" className="-rotate-90 h-full w-full">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-secondary"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color} score-ring`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold tabular-nums ${color}`}>
          {score}
        </span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Score
        </span>
      </div>
    </div>
  );
}

export function Sparkline({
  history,
}: {
  history: Array<{ score: number }>;
}) {
  if (history.length < 2) return null;
  const min = Math.min(...history.map((h) => h.score)) - 5;
  const max = Math.max(...history.map((h) => h.score)) + 5;
  const range = max - min || 1;
  const w = 200;
  const h = 32;
  const points = history
    .map((pt, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((pt.score - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-8 w-full opacity-50"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-emerald-400"
      />
    </svg>
  );
}
