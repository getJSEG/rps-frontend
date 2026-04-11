type FeatherFlagArtworkPreviewProps = {
  variant: "ok" | "error";
  fileName: string;
  /** When false, only the diagram (no filename line below). */
  showFileName?: boolean;
};

/**
 * Schematic feather-flag preview (placeholder until real proofs load from the API).
 */
export default function FeatherFlagArtworkPreview({
  variant,
  fileName,
  showFileName = true,
}: FeatherFlagArtworkPreviewProps) {
  const dimColor = variant === "error" ? "#dc2626" : "#111827";
  const stroke = variant === "error" ? "#991b1b" : "#111827";
  const labelClass =
    variant === "error" ? "fill-red-600 text-[11px] font-semibold" : "fill-gray-900 text-[11px] font-semibold";

  return (
    <div
      className={`flex w-full max-w-md flex-col items-center ${
        variant === "error" ? "rounded-lg ring-2 ring-red-100 ring-offset-2 ring-offset-white" : ""
      }`}
    >
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 200 340" className="h-auto w-full" aria-hidden>
          <defs>
            <pattern id="artwork-checker" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#e5e7eb" />
              <rect x="8" y="8" width="8" height="8" fill="#e5e7eb" />
              <rect x="8" width="8" height="8" fill="#ffffff" />
              <rect y="8" width="8" height="8" fill="#ffffff" />
            </pattern>
          </defs>

          {/* Dimension brackets */}
          <g stroke={dimColor} strokeWidth={1.2} fill="none">
            <path d="M 20 24 L 20 18 L 175 18 L 175 24" />
            <path d="M 182 32 L 188 32 L 188 305 L 182 305" />
            <polygon points="20,21 16,18 24,18" fill={dimColor} stroke="none" />
            <polygon points="175,21 171,18 179,18" fill={dimColor} stroke="none" />
            <polygon points="185,32 188,28 188,36" fill={dimColor} stroke="none" />
            <polygon points="185,305 188,301 188,309" fill={dimColor} stroke="none" />
          </g>
          <text x="98" y="14" textAnchor="middle" className={labelClass}>
            25&quot;
          </text>
          <text x="196" y="175" textAnchor="middle" className={labelClass} transform="rotate(90 196 175)">
            80&quot;
          </text>

          {/* Flag blade */}
          <path
            d="M 48 40 Q 118 28 152 48 L 148 300 Q 100 312 52 296 Z"
            fill={variant === "error" ? "url(#artwork-checker)" : "#fafafa"}
            stroke={stroke}
            strokeWidth={2}
          />

          {variant === "error" && (
            <>
              <rect x="70" y="120" width="56" height="36" fill="#1f2937" opacity={0.85} rx={2} />
              <rect x="88" y="200" width="40" height="28" fill="#1f2937" opacity={0.7} rx={2} />
            </>
          )}

          {variant === "ok" && (
            <g opacity={0.55} stroke="#111827" strokeWidth={1.1} fill="none">
              <line x1="72" y1="90" x2="128" y2="90" />
              <line x1="72" y1="140" x2="120" y2="130" />
              <rect x="78" y="160" width="48" height="72" rx={2} />
            </g>
          )}
        </svg>
      </div>
      {showFileName ? (
        <p className="mt-3 max-w-full truncate text-center text-sm font-medium text-gray-800" title={fileName}>
          {fileName}
        </p>
      ) : null}
    </div>
  );
}
