import React from 'react';
import { BackgroundVideo } from './components/BackgroundVideo';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { StorytellingSection } from './components/StorytellingSection';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  return (
    <div className="relative w-full min-h-screen bg-[#EAF5FF] text-[#09172A] selection:bg-[#1769C2]/20">
      {/* Homepage Hero Section */}
      <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden select-none md:select-auto">
        {/* Existing Mascot Animation (Untouched internal logic, video source, and scrub controls) */}
        <BackgroundVideo className="absolute inset-0 z-0 w-full h-full pointer-events-none select-none object-cover object-[80%_center] sm:object-[74%_center] lg:object-[70%_center]" />

        {/* Top Navigation */}
        <Navbar />

        {/* Hero Content */}
        <HeroSection />
      </div>

      {/* Scroll-Driven Storytelling Section (Directly Below Hero) */}
      <StorytellingSection />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
