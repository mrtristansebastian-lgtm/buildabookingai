import { useId } from 'react';

export function BuildABookingBrand({ className = '', showWordmark = true, title = 'Build A Booking' }) {
  const rawId = useId().replace(/:/g, '');
  const accentId = `${rawId}-brand-accent`;
  const glowId = `${rawId}-brand-glow`;
  const viewWidth = showWordmark ? 318 : 76;

  return (
    <svg
      className={`build-booking-brand block overflow-visible ${className}`}
      viewBox={`0 0 ${viewWidth} 76`}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={accentId} x1="6" y1="66" x2="68" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d8ccff" />
          <stop offset="0.22" stopColor="#ffd4f2" />
          <stop offset="0.48" stopColor="#c6f7ff" />
          <stop offset="0.72" stopColor="#dcff80" />
          <stop offset="1" stopColor="#c8fff0" />
        </linearGradient>
        <filter id={glowId} x="-24" y="-24" width="124" height="124" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.42 0 0 0 0 0.96 0 0 0 0 1 0 0 0 0.72 0" />
          <feBlend in="SourceGraphic" mode="screen" />
        </filter>
      </defs>

      <g filter={`url(#${glowId})`} opacity="0.88">
        <path
          d="M18 14h24.5c9.2 0 16 6.1 16 14.2 0 5.9-3.6 10.7-9 12.7 7 1.9 11.8 7 11.8 14.1 0 8.9-7 15-17.4 15H18V14Z"
          stroke={`url(#${accentId})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>

      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14.5v47" strokeWidth="4.8" />
        <path
          d="M19 15h22.8c8.5 0 14.8 5.5 14.8 13.1 0 7.2-5.8 12.4-14.4 12.4H19"
          strokeWidth="4.8"
        />
        <path
          d="M28.4 40.5h16.8c9 0 15.4 5.4 15.4 12.9 0 7.4-6.2 12.6-15.4 12.6H19"
          strokeWidth="4.8"
        />
        <path d="M9.5 28.5h15" strokeWidth="4.2" />
        <path d="M9.5 51.5h15" strokeWidth="4.2" />
      </g>

      <g transform="translate(11 40)">
        <rect x="0.5" y="0.5" width="30" height="25" rx="6.5" fill="white" stroke="currentColor" strokeWidth="3" />
        <path d="M7.5 0.5v-5M23.5 0.5v-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M8.5 13.2l5 5 10-10.5" stroke={`url(#${accentId})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {showWordmark && (
        <g transform="translate(90 0)">
          <text
            x="0"
            y="45"
            fill="currentColor"
            fontFamily="'Plus Jakarta Sans', Inter, Manrope, Arial, sans-serif"
            fontSize="24"
            fontWeight="760"
            letterSpacing="-0.9"
          >
            Build A Booking
          </text>
          <path
            d="M1 54h116"
            stroke={`url(#${accentId})`}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.65"
            filter={`url(#${glowId})`}
          />
        </g>
      )}
    </svg>
  );
}
