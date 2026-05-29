interface WordmarkProps {
  className?: string;
  showName?: boolean;
}

/**
 * Editorial SVG monogram that line-draws on mount (stroke-dashoffset). Replaces
 * the old rotating 3D logo. `pathLength={100}` lets the dash animation work
 * regardless of the real path geometry. Reduced-motion fallback in globals.css
 * snaps the strokes to fully drawn.
 */
export function Wordmark({ className, showName = true }: WordmarkProps) {
  return (
    <span className={className ? `wordmark ${className}` : "wordmark"}>
      <svg
        className="wordmark-mark"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Quirin Schlegel monogram"
      >
        <circle className="wordmark-stroke" cx="50" cy="50" r="40" pathLength={100} />
        <text
          className="wordmark-mono"
          x="50"
          y="51"
          textAnchor="middle"
          dominantBaseline="central"
        >
          Q<tspan className="wordmark-mono-accent">S</tspan>
        </text>
      </svg>
      {showName ? <span className="wordmark-name">Quirin Schlegel</span> : null}
    </span>
  );
}
