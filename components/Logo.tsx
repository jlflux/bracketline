export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5h5v5H3z" fill="currentColor" stroke="none" opacity="0.25" />
      <path d="M3 5h5M3 10h5M8 7.5h4v9h4M3 14h5M3 19h5M8 16.5h4M16 12h5" />
    </svg>
  );
}
