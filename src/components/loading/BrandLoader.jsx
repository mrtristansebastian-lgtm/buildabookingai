import { BuildABookingMark } from '../BuildABookingBrand';

export function BrandLoader({ label = 'Loading workspace', variant = 'dark' }) {
  return (
    <div className="text-center">
      <div className="brand-loader-orbit mx-auto mb-6">
        <BuildABookingMark className="w-9 h-9" variant={variant} />
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-[0.35em] ${variant === 'light' ? 'text-white/40' : 'text-neutral-300'}`}>{label}</p>
    </div>
  );
}

export function LazySectionFallback({ label = 'Loading workspace', variant = 'dark' }) {
  return (
    <div className="min-h-[320px] w-full bg-white flex items-center justify-center text-center">
      <BrandLoader label={label} variant={variant} />
    </div>
  );
}
