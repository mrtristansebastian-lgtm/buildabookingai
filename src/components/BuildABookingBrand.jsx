export function BuildABookingBrand({ className = '', title = 'Build A Booking' }) {
  return (
    <svg
      className={`build-booking-brand block overflow-visible ${className}`}
      viewBox="0 0 236 44"
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="31"
        fill="#050505"
        fontFamily="'Plus Jakarta Sans', Inter, Manrope, Arial, sans-serif"
        fontSize="25"
        fontWeight="760"
        letterSpacing="-0.8"
      >
        Build A Booking
      </text>
    </svg>
  );
}
