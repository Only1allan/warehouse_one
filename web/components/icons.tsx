import type { SVGProps } from "react";

const paths = {
  shelf: (
    <>
      <path d="M4 5h16M4 12h16M4 19h16" />
      <rect x="6" y="6.5" width="4.5" height="4" rx="0.8" />
      <rect x="13" y="13.5" width="4.5" height="4" rx="0.8" />
    </>
  ),
  ask: (
    <>
      <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />
      <path d="M9 11h6M9 14h3.5" />
    </>
  ),
  receive: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  count: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 9.5h8M8 14.5h5" />
      <path d="M16 15l1.4 1.4 2.2-2.6" />
    </>
  ),
  supervisor: (
    <>
      <path d="M9 4h6l1 2h3v14H5V6h3l1-2Z" />
      <path d="M9 13l2 2 4-4.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6L12 3Z" />
      <path d="M8.8 12l2.3 2.3L15.5 9.8" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3.2L9 5.5h6L16.8 8H20v11H4V8Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  send: <path d="M4 12L20 4l-4.5 16-3.5-6.5L4 12Zm8 1.5L20 4" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4v-9Z" />,
  truck: (
    <>
      <path d="M3 6h11v10H3V6ZM14 10h4l3 3v3h-7v-6Z" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  note: (
    <>
      <path d="M6 3h9l4 4v14H6V3Z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5M15 8l4 4-4 4M9 12h10" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3L12 4Z" />
      <path d="M12 10v4.5M12 17.5v.2" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.2" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9.5 9.5h5v5h-5zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 24,
  ...props
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
