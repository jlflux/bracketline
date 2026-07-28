export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 3H6v6a6 6 0 0 0 12 0V3z" />
      <path d="M6 5H4a2.5 2.5 0 0 0 2.4 3.4" />
      <path d="M18 5h2a2.5 2.5 0 0 1-2.4 3.4" />
      <path d="M12 15v3" />
      <path d="M8.5 21h7" />
      <path d="M9.5 21c0-1.6 1-2.6 2.5-3 1.5.4 2.5 1.4 2.5 3" />
    </svg>
  );
}
