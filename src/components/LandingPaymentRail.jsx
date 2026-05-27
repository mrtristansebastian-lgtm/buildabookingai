import { CircleDollarSign, Landmark } from 'lucide-react';

const paymentProviders = [
  { name: 'Stripe', logo: '/payment-logos/stripe.png' },
  { name: 'Payfast', logo: '/payment-logos/payfast.png' },
  { name: 'Yoco', logo: '/payment-logos/yoco.webp' },
  { name: 'Ozow', logo: '/payment-logos/ozow.png' },
  { name: 'Paystack', logo: '/payment-logos/paystack.png' },
  { name: 'Cash', icon: CircleDollarSign },
  { name: 'Direct EFT', icon: Landmark }
];

export function LandingPaymentRail() {
  return (
    <section className="native-payment-rail-section px-4 sm:px-6 pb-16 md:pb-32">
      <div className="native-payment-rail-shell max-w-7xl mx-auto overflow-hidden bg-white">
        <div className="native-payment-rail-head px-5 py-6 sm:px-8 md:px-12 md:py-10 text-center flex flex-col items-center gap-4">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400 mb-3">Merchant accounts</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-black leading-none">Plug in your payment gateway.</h2>
            <p className="mt-4 text-base md:text-lg font-medium leading-relaxed text-neutral-500">
              Connect the payment providers your business already uses, keep checkout familiar for clients, and track revenue from one clean finance desk.
            </p>
          </div>
        </div>

        <div className="native-payment-marquee border-t border-neutral-100">
          <div className="native-payment-marquee-track">
            {[...paymentProviders, ...paymentProviders].map((provider, index) => {
              const IconCmp = provider.icon;
              return (
                <div key={`${provider.name}-${index}`} className={`native-payment-logo-card ${IconCmp ? 'has-icon' : ''}`}>
                  {provider.logo ? <img src={provider.logo} alt={provider.name} loading="lazy" /> : (
                    <span className="native-payment-icon-mark" aria-hidden="true"><IconCmp size={18} /></span>
                  )}
                  <span>{provider.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
