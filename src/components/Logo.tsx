export function Symbol({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <rect width="96" height="96" rx="28" fill="#0F1B2D" />
      <circle cx="48" cy="50" r="22" fill="none" stroke="#FFF6E8" strokeWidth="9" strokeLinecap="round"
        pathLength={100} strokeDasharray="70 30" transform="rotate(-90 48 50)" />
      <circle cx="31" cy="36" r="7.5" fill="#FF4D2E" />
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="logo" aria-label="زنقة">
      <Symbol size={size} />
      <span className="logo-word" style={{ fontSize: size * 0.8 }}>زنقة</span>
    </span>
  );
}
