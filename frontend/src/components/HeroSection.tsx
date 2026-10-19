import React from 'react';

interface HeroSectionProps {
  onOpenDashboard?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDashboard }) => {
  return (
    <section className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 flex-1 flex flex-col justify-center py-10 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full">
        {/* Left Column: Content */}
        <div className="lg:col-span-7 xl:col-span-7 max-w-[620px] flex flex-col items-start">
          {/* Eyebrow Label */}
          <div className="font-sans font-medium text-[13px] sm:text-[14px] text-[#1769C2] tracking-[0.22em] uppercase mb-4 sm:mb-6 select-none">
            URBAN FLOOD INTELLIGENCE
          </div>

          {/* Headline */}
          <h1
            className="font-serif font-normal text-left tracking-tight mb-5 sm:mb-7 select-none"
            style={{
              fontSize: 'clamp(48px, 6.8vw, 108px)',
              lineHeight: 0.98,
            }}
          >
            <span className="block text-[#09172A]">See the risk.</span>
            <span className="block text-[#1769C2]">Fix the cause.</span>
          </h1>

          {/* Supporting Paragraph */}
          <p className="font-sans font-normal text-[#526984] text-[18px] sm:text-[20px] lg:text-[21px] leading-[1.45] max-w-[560px] mb-8 sm:mb-10 select-none">
            Citizen reports and flood insights that help cities understand recurring
            waterlogging and act sooner.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-5 w-full sm:w-auto">
            {/* Primary CTA */}
            <button
              type="button"
              onClick={onOpenDashboard}
              className="group inline-flex items-center justify-center gap-3 bg-[#1769C2] hover:bg-[#1257A2] text-white font-sans font-medium text-[16px] sm:text-[17px] h-[58px] sm:h-[62px] px-8 sm:px-9 rounded-full shadow-[0_12px_28px_-6px_rgba(23,105,194,0.38)] hover:shadow-[0_16px_34px_-6px_rgba(23,105,194,0.48)] transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Explore JalDrishti</span>
              <span className="inline-block transform group-hover:translate-x-1 transition-transform duration-200 text-lg leading-none">
                &rarr;
              </span>
            </button>

            {/* Secondary CTA */}
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center bg-[#EAF5FF]/80 hover:bg-white text-[#1769C2] hover:text-[#09172A] border border-[#CADDF0] hover:border-[#1769C2] font-sans font-medium text-[16px] sm:text-[17px] h-[58px] sm:h-[62px] px-8 sm:px-9 rounded-full transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-xs"
            >
              <span>How it works</span>
            </a>
          </div>
        </div>

        {/* Right Column: Visual space reserved for existing mascot animation */}
        <div
          className="hidden lg:block lg:col-span-5 xl:col-span-5 min-h-[460px] pointer-events-none select-none"
          aria-hidden="true"
        />
      </div>

      {/* Footer Detail within Hero */}
      <div className="w-full flex justify-end pt-8 lg:pt-12">
        <span className="font-sans font-medium text-[10px] sm:text-[11px] text-[#526984]/70 tracking-[0.25em] uppercase select-none">
          CURIOUS BY DESIGN &middot; BUILT FOR RESILIENT CITIES
        </span>
      </div>
    </section>
  );
};
