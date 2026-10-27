export function BrandMark({ className = "", ...props }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M32 3C16 3 5 17 5 34v20h54V34C59 17 48 3 32 3Z"
        fill="currentColor"
      />
      <path
        d="M32 8C19 8 10 20 10 34v15h44V34C54 20 45 8 32 8Z"
        stroke="var(--logo-ink,#f8f3ec)"
        strokeWidth=".8"
      />
      <g
        stroke="var(--logo-ink,#f8f3ec)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 31h23v6a10 10 0 0 1-10 10h-3a10 10 0 0 1-10-10v-6Z" />
        <path d="M42 32h3a5 5 0 0 1 0 10h-5M16 50h30M26 25c-5-6 4-7 0-13M34 26c-4-5 4-6 1-11" />
      </g>
      <path
        d="M32 42c-7-4-9-7-6-9 2-1 4 0 6 2 2-2 4-3 6-2 3 2 1 5-6 9Z"
        fill="var(--logo-ink,#f8f3ec)"
      />
      <path
        d="M12 59h40"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="32"
        cy="59"
        r="2.5"
        fill="currentColor"
        stroke="var(--logo-ink,#f8f3ec)"
      />
    </svg>
  );
}
export default function Brand() {
  return (
    <>
      <BrandMark />
      <span className="brand-wordmark">
        brew haven<small>COFFEE & GOOD COMPANY</small>
      </span>
    </>
  );
}
