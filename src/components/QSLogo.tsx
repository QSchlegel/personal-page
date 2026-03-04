type QSLogoProps = {
  className?: string;
};

export function QSLogo({ className }: QSLogoProps) {
  const svgClassName = className ? `qs-logo ${className}` : "qs-logo";

  return (
    <svg className={svgClassName} viewBox="0 0 72 72" role="img" aria-label="QS logo">
      <circle className="qs-logo-orbit" cx="36" cy="36" r="31" />
      <circle className="qs-logo-orbit-secondary" cx="36" cy="36" r="26" />
      <rect className="qs-logo-bg" x="14" y="14" width="44" height="44" rx="13" />
      <path className="qs-logo-gloss" d="M20 20h22c4.4 0 8 3.6 8 8v2H20z" />
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
