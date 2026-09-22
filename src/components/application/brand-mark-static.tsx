/**
 * The Business OS mark without animation: six green petals around a white six-pointed star, the same shapes as the animated <BrandMark>.
 * A plain server component, so it can be printed (the quotation footer). The gradient ends are the brand lime and green.
 */
const PETAL_ANGLES = [0, 60, 120, 180, 240, 300] as const;

export function BrandMarkStatic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <defs>
        <linearGradient id="bos-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c5ee6a" />
          <stop offset="1" stopColor="#2a8a4a" />
        </linearGradient>
      </defs>
      {PETAL_ANGLES.map((angle) => (
        <circle key={angle} cx={50 + 22 * Math.cos((angle * Math.PI) / 180)} cy={50 + 22 * Math.sin((angle * Math.PI) / 180)} r={24} fill="url(#bos-mark-gradient)" fillOpacity={0.82} />
      ))}
      <polygon points="50,33 64.72,58.5 35.28,58.5" fill="#fff" />
      <polygon points="50,67 64.72,41.5 35.28,41.5" fill="#fff" />
    </svg>
  );
}
