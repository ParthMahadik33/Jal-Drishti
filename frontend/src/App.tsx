import React, { useState, useEffect } from 'react';
import { BackgroundVideo } from './components/BackgroundVideo';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { StorytellingSection } from './components/StorytellingSection';
import { Footer } from './components/Footer';
import { OfficerDashboard } from './components/dashboard/OfficerDashboard';
import { LayoutDashboard } from 'lucide-react';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'dashboard'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/dashboard') || hash === '#dashboard') {
        return 'dashboard';
      }
    }
    return 'home';
  });

  // Sync with browser URL navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/dashboard') || hash === '#dashboard') {
        setCurrentScreen('dashboard');
      } else {
        setCurrentScreen('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (screen: 'home' | 'dashboard') => {
    setCurrentScreen(screen);
    const targetUrl = screen === 'dashboard' ? '/dashboard' : '/';
    window.history.pushState(null, '', targetUrl);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // If officer dashboard route is active, render dashboard directly
  if (currentScreen === 'dashboard') {
    return <OfficerDashboard onNavigateHome={() => navigateTo('home')} />;
  }

  // Otherwise, render the completed public homepage (Hero Mascot + Scrollytelling untouched)
  return (
    <div className="relative w-full min-h-screen bg-[#EAF5FF] text-[#09172A] selection:bg-[#1769C2]/20">
      {/* Floating Quick Jump to Officer Dashboard */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => navigateTo('dashboard')}
          className="group flex items-center gap-2.5 px-4 py-2.5 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-full shadow-[0_8px_24px_rgba(23,105,194,0.35)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-[13.5px] font-semibold select-none cursor-pointer border border-white/20"
          aria-label="Open JalDrishti Officer Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Officer Dashboard</span>
          <span className="transform group-hover:translate-x-0.5 transition-transform">
            &rarr;
          </span>
        </button>
      </div>

      {/* Homepage Hero Section */}
      <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden select-none md:select-auto">
        {/* Existing Mascot Animation (Untouched internal logic, video source, and scrub controls) */}
        <BackgroundVideo className="absolute inset-0 z-0 w-full h-full pointer-events-none select-none object-cover object-[80%_center] sm:object-[74%_center] lg:object-[70%_center]" />

        {/* Top Navigation */}
        <Navbar onOpenDashboard={() => navigateTo('dashboard')} />

        {/* Hero Content */}
        <HeroSection onOpenDashboard={() => navigateTo('dashboard')} />
      </div>

      {/* Scroll-Driven Storytelling Section (Directly Below Hero) */}
      <StorytellingSection />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
