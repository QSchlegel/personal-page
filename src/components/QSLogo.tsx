type QSLogoProps = {
  className?: string;
};

export function QSLogo({ className }: QSLogoProps) {
  const svgClassName = className ? `qs-logo ${className}` : "qs-logo";

  return (
    <svg className={svgClassName} viewBox="0 0 72 72" role="img" aria-label="QS logo">
      <circle className="qs-logo-orbit" cx="36" cy="36" r="31" />
      <rect className="qs-logo-bg" x="14" y="14" width="44" height="44" rx="13" />
      <text
        className="qs-logo-text"
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="23"
        fontWeight="700"
      >
        QS
      </text>
    </svg>
  );
}
