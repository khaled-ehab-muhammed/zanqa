export function Symbol({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <rect width="96" height="96" rx="28" fill="#0F1B2D" />
      <g transform="translate(48 48) scale(0.72) translate(-48 -48)"><path d="M15.85 55.42A33 33 0 0 1 61.42 17.85" fill="none" stroke="#FFF6E8" strokeWidth="9" strokeLinecap="round"/><path d="M80.92 45.70A33 33 0 0 1 35.11 78.38" fill="none" stroke="#FFF6E8" strokeWidth="9" strokeLinecap="round"/><circle cx="75.52" cy="29.79" r="8" fill="#FF4D2E"/><circle cx="48" cy="48" r="8" fill="#FF4D2E"/></g>
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
