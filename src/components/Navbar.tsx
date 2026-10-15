import React, { useState } from 'react';
import logoWithText from '../assets/logo-with-text.png';

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Cities', href: '#for-cities' },
  { label: 'Impact', href: '#impact' },
];

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="relative z-30 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 pt-6 sm:pt-8">
      <div className="flex items-center justify-between">
        {/* Left: Brand Logo from assets */}
        <a
          href="#"
          className="flex items-center group transition-transform duration-200 hover:scale-[1.01]"
          aria-label="JalDrishti Home"
        >
          <img
            src={logoWithText}
            alt="JalDrishti Logo"
            className="h-14 sm:h-16 md:h-[68px] w-auto object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </a>

        {/* Centre: Navigation links (Desktop) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-9 lg:gap-11"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-sans font-medium text-[15px] lg:text-[16px] text-[#09172A] hover:text-[#1769C2] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right: Outlined CTA button (Desktop) */}
        <div className="hidden md:flex items-center">
          <a
            href="#get-started"
            className="group font-sans font-medium text-[14px] lg:text-[15px] text-[#09172A] border border-[#CADDF0] hover:border-[#1769C2] hover:text-[#1769C2] bg-white/40 hover:bg-white/80 backdrop-blur-xs rounded-full px-5 lg:px-6 py-2.5 transition-all duration-200 flex items-center gap-2 shadow-xs"
          >
            <span>Get Started</span>
            <span className="transform group-hover:translate-x-0.5 transition-transform duration-200">
              &rarr;
            </span>
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 z-40 rounded-full bg-white/60 backdrop-blur-xs border border-[#CADDF0] focus:outline-none"
          aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileMenuOpen}
        >
          <span
            className={`w-5 h-[2px] bg-[#09172A] transition-all duration-300 ${
              mobileMenuOpen ? 'rotate-45 translate-y-[6px]' : ''
            }`}
          />
          <span
            className={`w-5 h-[2px] bg-[#09172A] transition-all duration-300 ${
              mobileMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`w-5 h-[2px] bg-[#09172A] transition-all duration-300 ${
              mobileMenuOpen ? '-rotate-45 -translate-y-[6px]' : ''
            }`}
          />
        </button>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-30 bg-[#EAF5FF]/98 backdrop-blur-md flex flex-col justify-center items-start px-8 gap-8 md:hidden transition-all duration-300 ${
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex flex-col gap-6 w-full">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="font-sans text-[24px] font-medium text-[#09172A] hover:text-[#1769C2] transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#get-started"
            onClick={() => setMobileMenuOpen(false)}
            className="mt-4 font-sans font-medium text-[16px] text-center text-[#09172A] border border-[#1769C2] bg-white rounded-full py-3.5 px-6 shadow-xs"
          >
            Get Started &rarr;
          </a>
        </div>
      </div>
    </header>
  );
};
