export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-teal-700" />
      <circle cx="16" cy="16" r="3.2" className="fill-white" />
      <path
        d="M16 5.5a10.5 10.5 0 0 1 9.1 5.25M26.5 16a10.5 10.5 0 0 1-5.25 9.1M16 26.5a10.5 10.5 0 0 1-9.1-5.25M5.5 16a10.5 10.5 0 0 1 5.25-9.1"
        className="stroke-teal-100"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
