import React from 'react';
import logoWithText from '../assets/logo-with-text.png';

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-20 w-full bg-[#EAF5FF] border-t border-[#CADDF0]/70 py-12 sm:py-16">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={logoWithText}
            alt="JalDrishti Logo"
            className="h-10 w-auto object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        <div className="flex items-center gap-6 sm:gap-8 text-[14px] font-sans text-[#526984]">
          <a href="#how-it-works" className="hover:text-[#1769C2] transition-colors">
            How It Works
          </a>
          <a href="#for-cities" className="hover:text-[#1769C2] transition-colors">
            For Cities
          </a>
          <a href="#impact" className="hover:text-[#1769C2] transition-colors">
            Impact
          </a>
          <a href="#get-started" className="hover:text-[#1769C2] transition-colors">
            Get Started
          </a>
        </div>

        <div className="text-[12px] font-sans text-[#526984]/70">
          &copy; {new Date().getFullYear()} JalDrishti. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
