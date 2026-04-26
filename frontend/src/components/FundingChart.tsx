"use client";

interface FundingChartProps {
  fundingTarget: number;
  fundsCommitted: number;
}

/**
 * Lightweight SVG-based funding chart — intentionally kept dependency-free so
 * it can be lazy-loaded without pulling in a heavy charting library on the
 * critical path.  Swap the SVG body for a recharts/apexcharts component here
 * once those libraries are added; the dynamic() import in page.tsx ensures
 * they will never block LCP.
 */
export default function FundingChart({ fundingTarget, fundsCommitted }: FundingChartProps) {
  const pct = Math.min(100, Math.round((fundsCommitted / fundingTarget) * 100));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-label={`${pct}% funded`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="url(#grad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <text x="70" y="66" textAnchor="middle" fill="white" fontSize="22" fontWeight="700">{pct}%</text>
        <text x="70" y="84" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">funded</text>
      </svg>
      <p className="text-xs text-white/50">
        ${(fundsCommitted / 1_000).toFixed(0)}K of ${(fundingTarget / 1_000).toFixed(0)}K raised
      </p>
    </div>
  );
}
