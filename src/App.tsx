import React from 'react';
import { BackgroundVideo } from './components/BackgroundVideo';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';

export const App: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-[#EAF5FF] overflow-hidden select-none md:select-auto">
      {/* Existing Mascot Animation (Internal logic, source video & scrub controls fully preserved) */}
      <BackgroundVideo />

      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection />
    </div>
  );
};

export default App;
