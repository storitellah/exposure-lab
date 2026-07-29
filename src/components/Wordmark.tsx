/**
 * Original Tatu symbol: three connected camera-control dots forming a
 * triangle inside an aperture-like ring. Not derived from any existing logo.
 */
export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="21" fill="none" stroke="#FBB03B" strokeWidth="4" />
      <path d="M24 12 L34.4 30 L13.6 30 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24" cy="12" r="4.4" fill="#FBB03B" />
      <circle cx="34.4" cy="30" r="4.4" fill="#3C82F6" />
      <circle cx="13.6" cy="30" r="4.4" fill="#2E9B62" />
    </svg>
  );
}
