import type { CSSProperties } from 'react';

type LogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Stylised bicycle-wheel logo for the app.
 *
 * The wheel ring uses a fixed blue→red gradient (Union-flag inspired) so it
 * stays on-brand in both light and dark mode. Spokes and the hub use
 * `currentColor` so they inherit the surrounding text colour.
 */
export default function Logo({ size = 32, className, title = 'PeloPoints' }: LogoProps) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="bccv-logo-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>

      {/* Tyre / outer ring */}
      <circle cx="32" cy="32" r="27" fill="none" stroke="url(#bccv-logo-ring)" strokeWidth="5" />

      {/* Spokes */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <line x1="32" y1="9" x2="32" y2="55" />
        <line x1="9" y1="32" x2="55" y2="32" />
        <line x1="15.7" y1="15.7" x2="48.3" y2="48.3" />
        <line x1="48.3" y1="15.7" x2="15.7" y2="48.3" />
      </g>

      {/* Hub */}
      <circle cx="32" cy="32" r="5" fill="currentColor" />
      <circle cx="32" cy="32" r="2" fill="#fff" />

      {/* Motion accent / chainring chevron */}
      <path
        d="M44 50 L52 50 L48 56 Z"
        fill="url(#bccv-logo-ring)"
      />
    </svg>
  );
}
