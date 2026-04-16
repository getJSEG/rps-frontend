type ArtworkInvitePreviewIllustrationProps = {
  variant: "ok" | "error";
};

/**
 * Friendly placeholder when no artwork preview is available yet (no harsh technical diagram).
 */
export default function ArtworkInvitePreviewIllustration({ variant }: ArtworkInvitePreviewIllustrationProps) {
  const isOk = variant === "ok";
  return (
    <div
      className={`flex w-full max-w-[300px] flex-col items-center ${
        isOk ? "text-emerald-700" : "text-sky-800"
      }`}
    >
      <svg
        viewBox="0 0 280 320"
        className="h-auto w-full max-h-[min(48vh,400px)] min-h-[260px] drop-shadow-sm"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Illustration: add your artwork to see a preview here"
      >
        <defs>
          <linearGradient id="invite-bg-ok" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ecfdf5" />
            <stop offset="100%" stopColor="#d1fae5" />
          </linearGradient>
          <linearGradient id="invite-bg-err" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0f9ff" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="invite-hill-back" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isOk ? "#6ee7b7" : "#7dd3fc"} stopOpacity="0.55" />
            <stop offset="100%" stopColor={isOk ? "#34d399" : "#38bdf8"} stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="invite-hill-front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isOk ? "#10b981" : "#0ea5e9"} stopOpacity="0.45" />
            <stop offset="100%" stopColor={isOk ? "#059669" : "#0284c7"} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        <rect
          x="10"
          y="10"
          width="260"
          height="300"
          rx="20"
          fill={isOk ? "url(#invite-bg-ok)" : "url(#invite-bg-err)"}
          stroke={isOk ? "#a7f3d0" : "#bae6fd"}
          strokeWidth="1.5"
        />

        {/* Picture frame — taller inner “print” area */}
        <rect
          x="44"
          y="44"
          width="192"
          height="218"
          rx="14"
          fill="#ffffff"
          fillOpacity="0.94"
          stroke={isOk ? "#6ee7b7" : "#7dd3fc"}
          strokeWidth="2"
        />

        {/* Sun */}
        <circle cx="206" cy="92" r="16" fill="#fde68a" fillOpacity="0.95" />

        {/* Hills — more vertical room inside frame */}
        <path
          d="M 56 232 Q 108 178 156 202 T 236 214 L 236 252 L 56 252 Z"
          fill="url(#invite-hill-back)"
        />
        <path
          d="M 56 252 Q 118 198 174 224 T 248 236 L 248 258 L 56 258 Z"
          fill="url(#invite-hill-front)"
        />

        <path
          d="M 58 64 L 86 64 L 58 92 Z"
          fill={isOk ? "#a7f3d0" : "#bae6fd"}
          fillOpacity="0.75"
        />

        {/* Upload hint */}
        <circle
          cx="140"
          cy="288"
          r="18"
          fill="#ffffff"
          fillOpacity="0.96"
          stroke={isOk ? "#6ee7b7" : "#7dd3fc"}
          strokeWidth="1.25"
        />
        <path
          d="M 140 278 v 12 M 132 286 l 8-8 8 8"
          fill="none"
          stroke={isOk ? "#047857" : "#0369a1"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.78"
        />
      </svg>
    </div>
  );
}
