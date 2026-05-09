"use client";

import { useEffect, useState } from "react";
import type { HuddleRecommendationView } from "@/lib/huddles/queries";
import { cn } from "@/lib/utils/cn";

/**
 * Animated spin wheel. Three equal sectors, one per recommendation.
 *
 * Math: target rotation lands the winner sector under the top arrow. We
 * always spin clockwise multiple full turns first, then ease into the
 * winner offset. A small per-spin random jitter keeps the deceleration
 * feeling natural on repeat spins.
 */
const SPIN_DURATION_MS = 3500;
const FULL_TURNS = 5;

export function SpinWheel({
  recommendations,
  spinning,
  winnerRank,
}: {
  recommendations: HuddleRecommendationView[];
  spinning: boolean;
  winnerRank: number | null;
}) {
  const segCount = Math.max(1, recommendations.length);
  const segAngle = 360 / segCount;
  const [rotation, setRotation] = useState(0);

  // When a winner is locked in, compute final angle and start the animation.
  useEffect(() => {
    if (!spinning || winnerRank == null) return;
    const winnerIdx = winnerRank - 1; // 1-based → 0-based
    const jitter = (Math.random() - 0.5) * (segAngle * 0.4); // ±20% of sector
    // Pointer is at the top (12 o'clock). We want sector center under the pointer.
    // Sector i's center sits at i * segAngle + segAngle/2 measured clockwise
    // from the top. Wheel rotates clockwise, so target = -((i*segAngle)+segAngle/2).
    const winnerOffset = -(winnerIdx * segAngle + segAngle / 2 + jitter);
    setRotation(FULL_TURNS * 360 + winnerOffset);
  }, [spinning, winnerRank, segAngle]);

  // Sector colors — matches the brand palette + provides clear visual sectors.
  const colors = [
    "#FF6B35", // primary
    "#3B82F6", // info blue
    "#10B981", // success emerald
    "#F59E0B", // warn
    "#A855F7", // accent
  ];

  // Build SVG sectors via polar coordinates.
  const radius = 110;
  const cx = 120;
  const cy = 120;

  const sectors = recommendations.map((rec, i) => {
    const startAngle = i * segAngle - 90; // -90 puts 0° at the top
    const endAngle = startAngle + segAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = segAngle > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    // Label position: middle of sector, 65% out from center.
    const midAngle = startAngle + segAngle / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const labelR = radius * 0.62;
    const lx = cx + labelR * Math.cos(midRad);
    const ly = cy + labelR * Math.sin(midRad);

    return {
      path,
      color: colors[i % colors.length],
      label: rec.name,
      rank: rec.rank,
      lx,
      ly,
      midAngle,
    };
  });

  return (
    <div className="flex justify-center py-3">
      <div className="relative" style={{ width: 240, height: 260 }}>
        {/* Pointer / arrow at 12 o'clock */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ top: -2 }}
        >
          <svg viewBox="0 0 24 16" width="24" height="16">
            <path
              d="M2 0 L22 0 L12 16 Z"
              fill="#1A1A1A"
              stroke="#fff"
              strokeWidth="2"
            />
          </svg>
        </div>

        <svg
          viewBox="0 0 240 240"
          width="240"
          height="240"
          className={cn(
            "drop-shadow-xl",
            spinning ? "ease-out" : "ease-out",
          )}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "120px 120px",
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.18, 0.9, 0.25, 1)`
              : "none",
          }}
        >
          <circle cx={cx} cy={cy} r={radius + 4} fill="#FFE4D6" />
          {sectors.map((s, i) => (
            <g key={i}>
              <path
                d={s.path}
                fill={s.color}
                stroke="white"
                strokeWidth="2"
              />
              {/* Counter-rotate text so it stays readable */}
              <text
                x={s.lx}
                y={s.ly}
                fontFamily="Plus Jakarta Sans, system-ui"
                fontWeight="800"
                fontSize="14"
                fill="white"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${s.midAngle + 90} ${s.lx} ${s.ly})`}
              >
                #{s.rank}
              </text>
            </g>
          ))}
          {/* Hub */}
          <circle
            cx={cx}
            cy={cy}
            r="20"
            fill="white"
            stroke="#FF6B35"
            strokeWidth="3"
          />
          <text
            x={cx}
            y={cy}
            fontSize="18"
            textAnchor="middle"
            dominantBaseline="central"
          >
            🎲
          </text>
        </svg>
      </div>
    </div>
  );
}
