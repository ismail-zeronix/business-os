"use client";

import { motion } from "framer-motion";
import { useId } from "react";

const PETAL_ANGLES = [0, 60, 120, 180, 240, 300] as const;
const PETAL_DISTANCE = 22;
const PETAL_RADIUS = 24;

/**
 * The Business OS mark, drawn in SVG: six overlapping green petals around a white six-pointed star. It is a client component only so it
 * can animate. Flip `expanded` and the mark makes one full turn while the petals pop in one after another; `initial={false}` means the
 * first paint is still and only a later change animates. Reduced-motion users get the change without the movement (MotionConfig upstream).
 */
export function BrandMark({ expanded, className }: { expanded: boolean; className?: string }) {
  const gradientId = useId();
  const state = expanded ? "open" : "closed";

  return (
    <motion.svg viewBox="0 0 100 100" aria-hidden className={className} initial={false} animate={{ rotate: expanded ? 360 : 0 }} transition={{ type: "spring", stiffness: 90, damping: 16 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c5ee6a" />
          <stop offset="1" stopColor="#2a8a4a" />
        </linearGradient>
      </defs>
      <motion.g initial={false} animate={state}>
        {PETAL_ANGLES.map((angle, index) => (
          <motion.circle
            key={angle}
            cx={50 + PETAL_DISTANCE * Math.cos((angle * Math.PI) / 180)}
            cy={50 + PETAL_DISTANCE * Math.sin((angle * Math.PI) / 180)}
            r={PETAL_RADIUS}
            fill={`url(#${gradientId})`}
            fillOpacity={0.82}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            variants={{
              open: { scale: [0.55, 1], transition: { delay: index * 0.035, type: "spring", stiffness: 260, damping: 14 } },
              closed: { scale: [0.55, 1], transition: { delay: index * 0.035, type: "spring", stiffness: 260, damping: 14 } },
            }}
          />
        ))}
      </motion.g>
      <polygon points="50,33 64.72,58.5 35.28,58.5" fill="#fff" />
      <polygon points="50,67 64.72,41.5 35.28,41.5" fill="#fff" />
    </motion.svg>
  );
}
