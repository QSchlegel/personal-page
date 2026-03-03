type QSLogoProps = {
  className?: string;
};

export function QSLogo({ className }: QSLogoProps) {
  const svgClassName = className ? `qs-logo ${className}` : "qs-logo";

  return (
    <svg className={svgClassName} viewBox="0 0 64 64" role="img" aria-label="QS logo">
      <rect className="qs-logo-bg" x="4" y="4" width="56" height="56" rx="14" />
      <text
        className="qs-logo-text"
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="28"
        fontWeight="700"
        fontFamily="Arial Black, Helvetica Neue, sans-serif"
      >
        QS
      </text>
    </svg>
  );
}
